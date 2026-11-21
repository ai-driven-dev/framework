import type { Scope } from "../../../../shared/domain/scope.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { Lock } from "../../../../shared/ports/lock.js";
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
  scope: Scope;
  marketplaceNames?: readonly string[];
}

/** What one sync run works on: the loaded manifest, the marketplaces it covers, the tools it
 * touches, and the way to persist the manifest to the repository it was read from. */
export interface SyncContext {
  manifest: Manifest;
  marketplaces: readonly DeclaredMarketplace[];
  toolIds: readonly ToolId[];
  save(): Promise<void>;
  /** The machine-wide manifest, absent when it is empty or not kept. */
  machineManifest(): Promise<Manifest | undefined>;
  /** Whether a machine-wide manifest is kept at all. */
  readonly machineKept: boolean;
  /** The manifest as last saved, not the one this run is changing. */
  persistedProject(): Promise<Manifest | undefined>;
}

/** What LoadSyncContext is built from. */
export interface LoadSyncContextDeps {
  readonly manifestRepo: ManifestRepository;
  readonly marketplaceRegistry: InstallationMarketplaceRegistry;
  /** The name the framework marketplace is registered under. */
  readonly frameworkMarketplaceName: string;
  /** Re-registers the shared machine-scope source when this run finds no marketplace at all.
   * Absent keeps the silent no-op instead of guessing what to register. */
  readonly marketplaceRegisterFrameworkUseCase?: FrameworkMarketplaceRegistrar;
  readonly userManifestRepo?: ManifestRepository & Lock;
}

export class LoadSyncContext {
  constructor(private readonly deps: LoadSyncContextDeps) {}

  /** A project-scope run holds the machine manifest's lock; a user-scope one already works on it. */
  runLocked<T>(scope: Scope, work: () => Promise<T>): Promise<T> {
    if (scope === "project" && this.deps.userManifestRepo !== undefined) {
      return this.deps.userManifestRepo.withExclusiveAccess(work);
    }
    return work();
  }

  private repositoryOf(scope: Scope): ManifestRepository {
    return scope === "user"
      ? (this.deps.userManifestRepo ?? this.deps.manifestRepo)
      : this.deps.manifestRepo;
  }

  /** `null` when there is no manifest or no marketplace to sync, so the run has nothing to do. */
  async execute(request: SyncContextRequest): Promise<SyncContext | null> {
    const { projectRoot } = request;
    const manifestRepo = this.repositoryOf(request.scope);
    const [manifest, initialMarketplaces] = await Promise.all([
      manifestRepo.load().catch(() => null),
      this.deps.marketplaceRegistry.list(projectRoot),
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
      machineManifest: async () => (await this.deps.userManifestRepo?.load()) ?? undefined,
      machineKept: this.deps.userManifestRepo !== undefined,
      persistedProject: async () => (await this.deps.manifestRepo.load()) ?? undefined,
    };
  }

  /**
   * Only ever called when `recreateFrameworkIfMissing` is set: every other caller reaching an
   * empty registry is reading a deliberate choice to have no marketplace at all. A project-scope
   * `aidd-framework` entry is retired to the machine-scope one here, carrying forward its own
   * `pluginSource`: the register use case's default would silently replace a project installed
   * from GitHub or a custom path with `{ kind: "local", path: "." }`.
   */
  private async ensureFrameworkRegistered(
    projectRoot: string,
    marketplaces: readonly DeclaredMarketplace[]
  ): Promise<readonly DeclaredMarketplace[]> {
    const framework = marketplaces.find((m) => m.name === this.deps.frameworkMarketplaceName);
    if (marketplaces.length > 0 && framework?.scope !== "project") return marketplaces;
    if (this.deps.marketplaceRegisterFrameworkUseCase === undefined) return marketplaces;
    await this.deps.marketplaceRegisterFrameworkUseCase.execute({
      projectRoot,
      pluginSource: framework?.source,
    });
    return this.deps.marketplaceRegistry.list(projectRoot);
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
