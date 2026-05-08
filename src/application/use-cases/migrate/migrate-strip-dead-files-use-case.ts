import { join } from "node:path";
import type { MigrationPlan } from "../../../domain/models/migration-plan.js";
import type { FileReader } from "../../../domain/ports/file-reader.js";
import type { FileWriter } from "../../../domain/ports/file-writer.js";
import type { Logger } from "../../../domain/ports/logger.js";

const USER_PROTECTED_PREFIXES = ["CLAUDE.md", "AGENTS.md", "copilot-instructions.md", "aidd_docs/"];

export interface MigrateStripDeadFilesOptions {
  projectRoot: string;
  plan: MigrationPlan;
}

export class MigrateStripDeadFilesUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly logger: Logger
  ) {}

  async execute(options: MigrateStripDeadFilesOptions): Promise<void> {
    for (const relPath of options.plan.filesToDelete) {
      await this.deleteIfSafe(options.projectRoot, relPath);
    }
  }

  private async deleteIfSafe(projectRoot: string, relPath: string): Promise<void> {
    if (this.isUserProtected(relPath)) {
      this.logger.warn(`Skipping protected file: ${relPath}`);
      return;
    }
    const absPath = join(projectRoot, relPath);
    if (!(await this.fs.fileExists(absPath))) return;
    await this.fs.deleteFile(absPath);
  }

  private isUserProtected(relPath: string): boolean {
    return USER_PROTECTED_PREFIXES.some(
      (prefix) => relPath === prefix || relPath.startsWith(prefix)
    );
  }
}
