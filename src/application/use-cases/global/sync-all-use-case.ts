import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { Logger } from "../../../domain/ports/logger.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import type { Prompter } from "../../../domain/ports/prompter.js";
import type { ToolId } from "../../../domain/tools/registry.js";
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
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly prompter: Prompter
  ) {}

  async execute(options: SyncAllOptions): Promise<SyncAllResult> {
    if (!options.interactive && !options.sourceTool) {
      throw new NonInteractiveSyncError();
    }
    const syncUseCase = new SyncUseCase(
      this.fs,
      this.manifestRepo,
      this.hasher,
      this.logger,
      this.prompter
    );
    const result = await syncUseCase.execute({
      projectRoot: options.projectRoot,
      sourceTool: options.sourceTool,
      force: false,
      includeUserFiles: false,
      interactive: options.interactive,
    });
    return {
      totalWritten: result.totalWritten,
      totalDeleted: result.totalDeleted,
      totalConflicts: result.totalConflicts,
      sourceTool: result.sourceTool,
    };
  }
}
