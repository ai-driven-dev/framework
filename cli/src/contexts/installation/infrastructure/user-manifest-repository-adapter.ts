import { mkdir, rmdir } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { isErrnoException } from "../../../shared/domain/reading/json-file.js";
import type { Lock } from "../../../shared/ports/lock.js";
import type { ManifestFileContext } from "../domain/manifest/assert-supported-version.js";
import { userManifestPath } from "../domain/project-layout.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";
import { ManifestFile, type ManifestFileDeps } from "./manifest-file-io.js";

/**
 * The user-scope counterpart of `ManifestRepositoryAdapter`: same schema, same version and refusal
 * rule, same file I/O. Only the path differs, and what a version-refusal message names to fix it.
 *
 * `delete()` removes only `manifest.json` and the record files beside it, never their parent
 * directory: `userConfigDir()` also holds `auth.json`, `marketplaces.json`, and `references.json`,
 * none of which this repository owns. Pruning it once empty, as the project adapter does with `.aidd/`, would be
 * a live bug here.
 */
export class UserManifestRepositoryAdapter
  extends ManifestFile
  implements ManifestRepository, Lock
{
  constructor(
    private readonly userConfigDir: () => string,
    deps: ManifestFileDeps
  ) {
    super(deps);
  }

  protected context(): ManifestFileContext {
    return {
      path: userManifestPath(this.userConfigDir()),
      location: "for this machine",
      scope: "user",
    };
  }

  async withExclusiveAccess<T>(action: () => Promise<T>): Promise<T> {
    const lock = `${this.path}.lock`;
    await mkdir(dirname(lock), { recursive: true });
    await this.acquire(lock);
    try {
      return await action();
    } finally {
      await rmdir(lock);
    }
  }

  /** Takes the lock directory, waiting for whoever holds it up to a deadline. */
  private async acquire(lock: string): Promise<void> {
    const deadline = Date.now() + 30_000;
    while (!(await tryTake(lock))) {
      if (Date.now() >= deadline) {
        throw new Error(
          `User manifest is busy: ${lock}. Retry after the other AIDD operation finishes.`
        );
      }
      await pause(100);
    }
  }
}

/** False when another process holds the lock directory. */
async function tryTake(lock: string): Promise<boolean> {
  try {
    await mkdir(lock);
    return true;
  } catch (error) {
    if (isErrnoException(error) && error.code === "EEXIST") return false;
    throw error;
  }
}
