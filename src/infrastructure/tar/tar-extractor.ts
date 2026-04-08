import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { TarExtractionError } from "../errors.js";

const execFileAsync = promisify(execFile);

export class TarExtractor {
  async extract(tarballPath: string, targetDir: string): Promise<string> {
    try {
      await execFileAsync("tar", ["xzf", tarballPath, "-C", targetDir]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new TarExtractionError(`Failed to extract tarball '${tarballPath}': ${message}`);
    }

    return this.findFrameworkRoot(targetDir);
  }

  private async findFrameworkRoot(targetDir: string): Promise<string> {
    const entries = await readdir(targetDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());
    const files = entries.filter((e) => e.isFile());

    if (dirs.length === 1 && files.length === 0) {
      // Single-directory nesting: GitHub wraps in `org-repo-sha/`
      return this.findFrameworkRoot(join(targetDir, dirs[0].name));
    }

    return targetDir;
  }
}
