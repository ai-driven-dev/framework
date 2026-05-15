import type { FileReader } from "../../../domain/ports/file-reader.js";
import type { FileWriter } from "../../../domain/ports/file-writer.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { Logger } from "../../../domain/ports/logger.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import type { ToolId } from "../../../domain/tools/registry.js";
import type { PluginInstallFromMarketplaceUseCase } from "../plugin/plugin-install-from-marketplace-use-case.js";
import type { SyncFilePropagationUseCase } from "../sync/sync-file-propagation-use-case.js";
import { SyncPluginsUseCase } from "../sync/sync-plugins-use-case.js";
import type { SyncSourceResolverUseCase } from "../sync/sync-source-resolver-use-case.js";
import { SyncUseCase } from "../sync/sync-use-case.js";

export class NonInteractiveSyncError extends Error {
  constructor() {
    super(
      "Non-interactive mode: use `aidd ai sync --source <tool>` or `aidd plugin sync --source <tool>` instead."
    );
    this.name = "NonInteractiveSyncError";
  }
}

export interface SyncAllOptions {
  projectRoot: string;
  interactive: boolean;
  sourceTool?: ToolId;
}

export interface SyncAllResult {
  totalWritten: number;
  totalDeleted: number;
  totalConflicts: number;
  sourceTool: string;
}

export class SyncAllUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly manifestRepo: ManifestRepository,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly syncSourceResolver: SyncSourceResolverUseCase,
    private readonly syncFilePropagation: SyncFilePropagationUseCase,
    private readonly pluginInstallFromMarketplace?: PluginInstallFromMarketplaceUseCase
  ) {}

  async execute(options: SyncAllOptions): Promise<SyncAllResult> {
    if (!options.interactive && !options.sourceTool) {
      throw new NonInteractiveSyncError();
    }
    const syncPluginsUseCase =
      this.pluginInstallFromMarketplace !== undefined
        ? new SyncPluginsUseCase(this.manifestRepo, this.pluginInstallFromMarketplace, this.logger)
        : undefined;
    const syncUseCase = new SyncUseCase(
      this.fs,
      this.manifestRepo,
      this.hasher,
      this.syncSourceResolver,
      this.syncFilePropagation,
      syncPluginsUseCase
    );
    const result = await syncUseCase.execute({
      projectRoot: options.projectRoot,
      sourceTool: options.sourceTool,
      force: false,
      includeUserFiles: false,
      interactive: options.interactive,
      includePlugins: true,
    });
    return {
      totalWritten: result.totalWritten,
      totalDeleted: result.totalDeleted,
      totalConflicts: result.totalConflicts,
      sourceTool: result.sourceTool,
    };
  }
}
