import type { MarketplaceScope } from "../../../../shared/domain/scope.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { RegistrationClaims } from "../../../host-registration/contract/native-registration.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type {
  DeclaredMarketplace,
  FrameworkMarketplaceRegistrar,
  InstallationMarketplaceRegistry,
} from "../../ports/marketplace-sources.js";

export interface SyncContextRequest {
  projectRoot: string;
  toolIds?: readonly ToolId[];
  recreateFrameworkIfMissing?: boolean;
  /** `"user"` works on the machine manifest, anything else on the project's. */
  scope: MarketplaceScope;
  marketplaceNames?: readonly string[];
}

/** What one sync run works on: the loaded manifest, the marketplaces it covers, the tools it
 * touches, and the way to persist the manifest to the repository it was read from. */
export interface SyncContext {
  manifest: Manifest;
  marketplaces: readonly DeclaredMarketplace[];
  toolIds: readonly ToolId[];
  save(): Promise<void>;
  /** What a host registration is checked against for one tool: the manifest's own record, the
   * machine's, and the one persisted for this project. */
  claimsOf(toolId: ToolId): RegistrationClaims;
}

export class LoadSyncContext {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly marketplaceRegistry: InstallationMarketplaceRegistry,
    /** The name the framework marketplace is registered under. */
    private readonly frameworkMarketplaceName: string,
    /** Re-registers the shared machine-scope source when this run finds no marketplace at all.
     * Absent keeps the silent no-op instead of guessing what to register. */
    private readonly marketplaceRegisterFrameworkUseCase?: FrameworkMarketplaceRegistrar,
    private readonly userManifestRepo?: ManifestRepository & Lock
  ) {}

  /** A project-scope run holds the machine manifest's lock; a user-scope one already works on it. */
  runLocked<T>(scope: MarketplaceScope, work: () => Promise<T>): Promise<T> {
    if (scope === "project" && this.userManifestRepo !== undefined) {
      return this.userManifestRepo.withExclusiveAccess(work);
    }
    return work();
  }

  private repositoryOf(scope: MarketplaceScope): ManifestRepository {
    return scope === "user" ? (this.userManifestRepo ?? this.manifestRepo) : this.manifestRepo;
  }

  /** `null` when there is no manifest or no marketplace to sync, so the run has nothing to do. */
  async execute(request: SyncContextRequest): Promise<SyncContext | null> {
    const { projectRoot } = request;
    const manifestRepo = this.repositoryOf(request.scope);
    const [manifest, initialMarketplaces] = await Promise.all([
      manifestRepo.load().catch(() => null),
      this.marketplaceRegistry.list(projectRoot),
    ]);
    if (manifest === null) return null;
    const recreatedMarketplaces = request.recreateFrameworkIfMissing
      ? await this.ensureFrameworkRegistered(projectRoot, initialMarketplaces)
      : initialMarketplaces;
    const marketplaces =
      request.marketplaceNames === undefined
        ? recreatedMarketplaces
        : recreatedMarketplaces.filter((m) => request.marketplaceNames?.includes(m.name));
    if (marketplaces.length === 0) return null;
    return {
      manifest,
      marketplaces,
      toolIds: this.selectToolIds(manifest, request.toolIds),
      save: () => manifestRepo.save(manifest),
      claimsOf: (toolId) => this.claimsOf(toolId, manifest),
    };
  }

  /**
   * Only ever called when `recreateFrameworkIfMissing` is set: every other caller reaching an
   * empty registry is reading a deliberate choice to have no marketplace at all. A project-scope
   * `aidd-framework` entry is retired to the machine-scope one here, carrying forward its own
   * `pluginSource` — the register use case's default would silently replace a project installed
   * from GitHub or a custom path with `{ kind: "local", path: "." }`.
   */
  private async ensureFrameworkRegistered(
    projectRoot: string,
    marketplaces: readonly DeclaredMarketplace[]
  ): Promise<readonly DeclaredMarketplace[]> {
    const framework = marketplaces.find((m) => m.name === this.frameworkMarketplaceName);
    if (marketplaces.length > 0 && framework?.scope !== "project") return marketplaces;
    if (this.marketplaceRegisterFrameworkUseCase === undefined) return marketplaces;
    await this.marketplaceRegisterFrameworkUseCase.execute({
      projectRoot,
      pluginSource: framework?.source,
    });
    return this.marketplaceRegistry.list(projectRoot);
  }

  private claimsOf(toolId: ToolId, manifest: Manifest): RegistrationClaims {
    return {
      recorded: manifest.getNativeRegistrations(toolId),
      machine: async () => (await this.userManifestRepo?.load())?.getNativeRegistrations(toolId),
      machineKept: this.userManifestRepo !== undefined,
      persistedProject: async () =>
        (await this.manifestRepo.load())?.getNativeRegistrations(toolId),
    };
  }

  private selectToolIds(
    manifest: Manifest,
    toolIds: readonly ToolId[] | undefined
  ): readonly ToolId[] {
    const installed = manifest.getInstalledToolIds();
    if (toolIds === undefined) return installed;
    const requested = new Set(toolIds);
    return installed.filter((toolId) => requested.has(toolId));
  }
}
