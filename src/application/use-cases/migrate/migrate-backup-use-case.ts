import { join } from "node:path";
import { AIDD_DIR } from "../../../domain/models/paths.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";

export interface MigrateBackupOptions {
  projectRoot: string;
}

export class MigrateBackupUseCase {
  constructor(private readonly fs: FileSystem) {}

  async execute(options: MigrateBackupOptions): Promise<string> {
    const manifestPath = join(options.projectRoot, AIDD_DIR, "manifest.json");
    const exists = await this.fs.fileExists(manifestPath);
    if (!exists) {
      throw new Error(`Cannot backup: manifest not found at ${manifestPath}`);
    }
    const backupPath = await this.fs.backup(manifestPath);
    return backupPath;
  }
}
