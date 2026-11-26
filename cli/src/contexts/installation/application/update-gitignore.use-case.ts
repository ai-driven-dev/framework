import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";

const GITIGNORE_FILENAME = ".gitignore";

export class UpdateGitignore {
  constructor(private readonly fs: FileReader & FileWriter) {}

  /** Appends the missing `entries`, or removes every one of them. `true` when the file changed. */
  execute(
    projectRoot: string,
    entries: string[],
    change: "append" | "remove" = "append"
  ): Promise<boolean> {
    return change === "append"
      ? this.append(projectRoot, entries)
      : this.remove(projectRoot, entries);
  }

  private async append(projectRoot: string, entries: string[]): Promise<boolean> {
    const gitignorePath = `${projectRoot}/${GITIGNORE_FILENAME}`;

    const existing = (await this.fs.fileExists(gitignorePath))
      ? await this.fs.readFile(gitignorePath)
      : "";

    const lines = existing.split("\n");
    const missing = entries.filter((entry) => !lines.some((line) => line.trim() === entry));

    if (missing.length === 0) return false;

    const toAppend = existing.endsWith("\n") || existing === "" ? "" : "\n";
    await this.fs.writeFile(gitignorePath, `${existing}${toAppend}${missing.join("\n")}\n`);
    return true;
  }

  private async remove(projectRoot: string, entries: string[]): Promise<boolean> {
    const gitignorePath = `${projectRoot}/${GITIGNORE_FILENAME}`;

    if (!(await this.fs.fileExists(gitignorePath))) return false;
    const existing = await this.fs.readFile(gitignorePath);

    const entrySet = new Set(entries);
    const filtered = existing
      .split("\n")
      .filter((line) => !entrySet.has(line.trim()))
      .join("\n");

    if (filtered === existing) return false;

    const trimmed = filtered.replace(/^\n+|\n+$/g, "");
    if (trimmed === "") {
      await this.fs.deleteFile(gitignorePath);
    } else {
      await this.fs.writeFile(gitignorePath, `${trimmed}\n`);
    }
    return true;
  }
}
