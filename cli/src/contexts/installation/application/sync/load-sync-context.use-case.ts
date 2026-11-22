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
import type {
  RecordsBesideManifest,
  RegistrationRecords,
} from "../../ports/record/registration-records.js";

export interface LoadSyncContextRequest {
  projectRoot: string;
  toolIds?: readonly ToolId[];
  recreateFrameworkIfMissing?: boolean;
  /** `"user"` works on the machine manifest, anything else on the project's. */
  scope: Scope;
  marketplaceNames?: readonly string[];
}

/** What one sync run works on: the loaded manifest and the records kept beside it, the
 * marketplaces it covers, the tools it touches, and the way to persist both to the repository
 * they were read from. */
export interface SyncContext {
  manifest: Manifest;
  records: RegistrationRecords;
  marketplaces: readonly DeclaredMarketplace[];
  toolIds: readonly ToolId[];
  save(): Promise<void>;
  /** The machine-wide records, none when no machine-wide manifest is kept. */
  machineRecords(): Promise<RegistrationRecords>;
  /** Whether a machine-wide manifest is kept at all. */
  readonly machineKept: boolean;
  /** The project's records as last saved, not the ones this run is changing. */
  persistedProject(): Promise<RegistrationRecords>;
}

/** What LoadSyncContext is built from. */
export interface LoadSyncContextDeps {
  readonly manifestRepo: ManifestRepository & RecordsBesideManifest;
  readonly marketplaceRegistry: InstallationMarketplaceRegistry;
  /** The name the framework marketplace is registered under. */
  readonly frameworkMarketplaceName: string;
  /** Re-registers the shared machine-scope source when this run finds no marketplace at all.
   * Absent keeps the silent no-op instead of guessing what to register. */
  readonly marketplaceRegisterFrameworkUseCase?: FrameworkMarketplaceRegistrar;
  readonly userManifestRepo?: ManifestRepository & RecordsBesideManifest & Lock;
}

export class LoadSyncContext {
  constructor(private readonly deps: LoadSyncContextDeps) {}

  private repositoryOf(scope: Scope): ManifestRepository & RecordsBesideManifest {
    return scope === "user"
      ? (this.deps.userManifestRepo ?? this.deps.manifestRepo)
      : this.deps.manifestRepo;
  }

  /** `null` when there is no manifest or no marketplace to sync, so the run has nothing to do. */
  async execute(request: LoadSyncContextRequest): Promise<SyncContext | null> {
    const { projectRoot } = request;
    const manifestRepo = this.repositoryOf(request.scope);
    const [manifest, initialMarketplaces] = await Promise.all([
      manifestRepo.loadIfReadable(),
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
    const records = await manifestRepo.loadRecords();
    return {
      manifest,
      records,
      marketplaces,
      toolIds: this.selectToolIds(manifest, request.toolIds),
      save: async () => {
        await manifestRepo.saveRecords(records);
        await manifestRepo.save(manifest);
      },
      machineRecords: async () => (await this.deps.userManifestRepo?.loadRecords()) ?? new Map(),
      machineKept: this.deps.userManifestRepo !== undefined,
      persistedProject: () => this.deps.manifestRepo.loadRecords(),
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
