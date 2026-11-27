import { randomBytes } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { errorMessage } from "../domain/describe-error.js";
import { whenAbsent } from "../domain/reading/json-file.js";
import type { PrivateStorage } from "../ports/private-storage.js";

const NEWLINE = 0x0a;

/** What the adapter asks of the machine, apart from the files: the composition root supplies the
 * machine's, tests substitute theirs so the Windows path runs on every runner. */
export interface PrivateStorageHost {
  readonly platform: NodeJS.Platform;
  readonly env: NodeJS.ProcessEnv;
  readonly run: (command: string, args: readonly string[]) => void;
}

/** The account icacls grants to. With no shell to expand `%USERNAME%`, it is read here, and
 * absent it would grant nobody, leaving a directory with its inheritance stripped. */
function windowsAccount(env: NodeJS.ProcessEnv): string {
  const account = env.USERNAME;
  if (account === undefined || account === "") {
    throw new Error("USERNAME is not set, so no account can be granted access");
  }
  return account;
}

/** Owner-only storage: directories 0700 and files 0600 on POSIX; on Windows the directory is
 * cut off from inherited access and granted to the account alone, and the files created in it
 * inherit that. */
export class PrivateStorageAdapter implements PrivateStorage {
  constructor(private readonly host: PrivateStorageHost) {}

  async ensureDirectory(path: string): Promise<void> {
    const created = await mkdir(path, { recursive: true, mode: 0o700 });
    if (this.host.platform !== "win32") {
      // A directory that already existed keeps the mode it was made with.
      await chmod(path, 0o700);
      return;
    }
    if (created === undefined) return;
    try {
      // An argument list, never a command line: the path comes from an environment variable.
      this.host.run("icacls", [
        created,
        "/inheritance:r",
        "/grant:r",
        `${windowsAccount(this.host.env)}:(OI)(CI)F`,
      ]);
    } catch (error) {
      throw new Error(`Failed to restrict ${created} to its owner: ${errorMessage(error)}`);
    }
  }

  /** A temporary sibling then `rename`: a reader never sees half a file, and a crash orphans
   * the temporary rather than truncating the real one. */
  async replace(path: string, content: string): Promise<void> {
    const temporary = `${path}.${randomBytes(6).toString("hex")}.tmp`;
    try {
      await writeFile(temporary, content, { mode: 0o600 });
      await rename(temporary, path);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }

  async read(path: string): Promise<string | undefined> {
    return whenAbsent(() => readFile(path, "utf-8"), undefined);
  }

  async append(path: string, content: string): Promise<void> {
    const handle = await open(path, "a+", 0o600);
    try {
      const { size } = await handle.stat();
      if (size > 0) {
        const last = Buffer.alloc(1);
        await handle.read(last, 0, 1, size - 1);
        if (last[0] !== NEWLINE) await handle.write("\n");
      }
      await handle.write(content);
    } finally {
      await handle.close();
    }
  }
}
