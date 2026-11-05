import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { type FileHandle, link, lstat, mkdir, open, realpath, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { UserReleaseJournalStore } from "../application/ownership/release/user-release-journal.js";

/** A private, exclusively created journal adjacent to the machine manifest. */
export class UserReleaseJournalStoreAdapter implements UserReleaseJournalStore {
  constructor(private readonly manifestPath: () => string) {}
  private get path(): string {
    return `${this.manifestPath()}.release-journal`;
  }

  async read(): Promise<string | null> {
    let handle: FileHandle;
    try {
      const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
      handle = await open(this.path, constants.O_RDONLY | noFollow);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    try {
      const info = await handle.stat();
      const pathInfo = await lstat(this.path);
      const dir = await realpath(dirname(this.path));
      if (
        !info.isFile() ||
        !pathInfo.isFile() ||
        info.ino !== pathInfo.ino ||
        info.dev !== pathInfo.dev ||
        (process.platform !== "win32" &&
          ((info.mode & 0o077) !== 0 || info.uid !== process.getuid?.())) ||
        (await realpath(this.path)) !== join(dir, basename(this.path))
      ) {
        throw new Error("User release journal is not a private owned file; recovery refused.");
      }
      return await handle.readFile("utf8");
    } finally {
      await handle.close();
    }
  }

  async create(content: string): Promise<void> {
    const dir = dirname(this.path);
    await mkdir(dir, { recursive: true });
    const temp = `${this.path}.${process.pid}-${randomBytes(12).toString("hex")}.tmp`;
    const handle = await open(temp, "wx", 0o600);
    try {
      try {
        await handle.writeFile(content, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      // link is an atomic no-replace operation. Another journal is never overwritten.
      await link(temp, this.path);
    } finally {
      await unlink(temp);
    }
  }

  async remove(): Promise<void> {
    if ((await this.read()) === null)
      throw new Error("User release journal disappeared before completion.");
    await unlink(this.path);
  }
}
