import { mkdir, rmdir } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { isErrnoException } from "../../../shared/domain/reading/json-file.js";
import type { Lock } from "../../../shared/ports/lock.js";
import { UserManifestBusyError } from "../contract/machine-claims.error.js";

/**
 * The machine-wide lock: a directory only one process can create, waited on up to a deadline and
 * never stolen. It is not re-entrant: an action that asks for it again waits on itself until the
 * deadline.
 */
export class UserScopeLockAdapter implements Lock {
  constructor(private readonly lockPath: () => string) {}

  async withExclusiveAccess<T>(action: () => Promise<T>): Promise<T> {
    const lock = this.lockPath();
    await mkdir(dirname(lock), { recursive: true });
    await acquire(lock);
    try {
      return await action();
    } finally {
      await rmdir(lock);
    }
  }
}

/** Takes the lock directory, waiting for whoever holds it up to a deadline. */
async function acquire(lock: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (!(await tryTake(lock))) {
    if (Date.now() >= deadline) {
      throw new UserManifestBusyError(lock);
    }
    await pause(100);
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
