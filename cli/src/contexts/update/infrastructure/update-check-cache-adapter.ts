import { join } from "node:path";
import type { FileReader } from "../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../kernel/ports/file-writer.js";
import type { CheckEntry } from "../domain/update-notice.js";
import type { UpdateCheckCache } from "../ports/update-check-cache.js";

/** Under `cache/`, beside every other disposable thing: nothing here is a choice a person
 * made. The directory is `userConfigDir()`'s, so the file a machine-scope `clean` purges is
 * the file this writes, whatever the machine's own configuration says. */
export class UpdateCheckCacheAdapter implements UpdateCheckCache {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly userConfigDir: () => string
  ) {}

  async read(): Promise<CheckEntry | null> {
    // The legacy path is read when the current one holds nothing, never written to, so an
    // existing install is not made to refetch.
    return (
      (await this.readAt(this.currentPath())) ??
      (await this.readAt(join(this.userConfigDir(), "update-check.json")))
    );
  }

  async write(entry: CheckEntry): Promise<void> {
    const path = this.currentPath();
    await this.fs.createDirectory(join(path, ".."));
    await this.fs.writeFile(
      path,
      JSON.stringify({ checkedAt: entry.checkedAt, latest: entry.latest })
    );
  }

  private currentPath(): string {
    return join(this.userConfigDir(), "cache", "update-check.json");
  }

  private async readAt(path: string): Promise<CheckEntry | null> {
    if (!(await this.fs.fileExists(path))) return null;
    try {
      return JSON.parse(await this.fs.readFile(path)) as CheckEntry;
    } catch {
      return null;
    }
  }
}
