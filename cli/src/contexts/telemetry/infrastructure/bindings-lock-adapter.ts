import type { BindingsLock } from "../domain/ports/bindings/bindings-lock.js";
import type { PrivateStorage } from "../domain/ports/private-storage.js";
import { DirectoryLock, type LockOptions } from "./ledger-lock.js";

/** `.lock` in the bindings directory: the same lock as the ledger's, on its own file. */
export class BindingsLockAdapter implements BindingsLock {
  private readonly lock: DirectoryLock;

  constructor(dir: string, storage: PrivateStorage, options: Partial<LockOptions> = {}) {
    this.lock = new DirectoryLock(dir, ".lock", storage, options);
  }

  exclusively<T>(work: () => Promise<T>): Promise<T> {
    return this.lock.exclusively(work);
  }
}
