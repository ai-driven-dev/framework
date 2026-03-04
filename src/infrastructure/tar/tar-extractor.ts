import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class TarExtractor {
  async extract(tarballPath: string, targetDir: string): Promise<string> {
    try {
      await execFileAsync("tar", ["xzf", tarballPath, "-C", targetDir]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to extract tarball '${tarballPath}': ${message}`);
    }

    return this.findFrameworkRoot(targetDir);
  }

  private async findFrameworkRoot(targetDir: string): Promise<string> {
    const entries = await readdir(targetDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());

    if (dirs.length === 1 && entries.filter((e) => e.isFile()).length === 0) {
      // Single-directory nesting: GitHub wraps in `org-repo-sha/`
      const nested = join(targetDir, dirs[0].name);
      return this.findFrameworkRoot(nested);
    }

    const hasFrameworkJson = entries.some((e) => e.isFile() && e.name === "framework.json");
    if (hasFrameworkJson) {
      return targetDir;
    }

    throw new Error(`framework.json not found in extracted tarball. Searched in '${targetDir}'.`);
  }
}
