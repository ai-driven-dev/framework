/**
 * The temporary folders a test makes, each removed once the test ends.
 */

import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const made: string[] = [];

/** A fresh folder under the system's temporary one, by its real path, so a path the code under
 * test resolves compares equal to it. */
export async function madeFolder(prefix: string): Promise<string> {
  const folder = await realpath(await mkdtemp(join(tmpdir(), prefix)));
  made.push(folder);
  return folder;
}

/** Removes every folder made since the last call. A hook may still hold one when the test ends:
 * a load-time hook still writing (ENOTEMPTY), or on Windows a detached hook's working folder
 * (EBUSY); both were observed, hence the retries. */
export async function removeMadeFolders(): Promise<void> {
  await Promise.all(
    made
      .splice(0)
      .map((folder) =>
        rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 })
      )
  );
}
