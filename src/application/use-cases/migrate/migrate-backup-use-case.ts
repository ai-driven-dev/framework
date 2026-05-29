import { join } from "node:path";
import { AIDD_DIR } from "../../../domain/models/paths.js";
import type { FileMerger } from "../../../domain/ports/file-merger.js";
import type { FileReader } from "../../../domain/ports/file-reader.js";
import { NoManifestError } from "../../errors.js";

export interface MigrateBackupOptions {
  projectRoot: string;
}

export class MigrateBackupUseCase {
  constructor(private readonly fs: FileReader & FileMerger) {}

  async execute(options: MigrateBackupOptions): Promise<string> {
    const manifestPath = join(options.projectRoot, AIDD_DIR, "manifest.json");
    const exists = await this.fs.fileExists(manifestPath);
    if (!exists) {
      throw new NoManifestError();
    }
    const backupPath = await this.fs.backup(manifestPath);
    return backupPath;
  }
}
