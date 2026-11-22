import type { LockWait } from "../../../domain/declaration/task-declaration.js";
import type { BindingsLock } from "../../../ports/bindings/bindings-lock.js";
import type { DirectoryLock } from "../ledger/directory-lock.js";

/** The bindings directory's lock: the same lock as the ledger's, on its own file. */
export class BindingsLockAdapter implements BindingsLock {
  constructor(private readonly lock: DirectoryLock) {}

  exclusively<T>(work: () => Promise<T>, wait?: LockWait): Promise<T> {
    return this.lock.exclusively(work, wait?.waitMs);
  }
}
