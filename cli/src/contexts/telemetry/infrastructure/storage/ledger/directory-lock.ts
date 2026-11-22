import type { PrivateStorage } from "../../../../../shared/ports/private-storage.js";
import type { LedgerLock } from "./ledger-lock.js";

interface DirectoryLockDeps {
  readonly dir: string;
  readonly storage: PrivateStorage;
  /** The lock on a file in `dir`. */
  readonly lock: LedgerLock;
}

/** A lock on a file in a directory kept private, taken around some work. */
export class DirectoryLock {
  constructor(private readonly deps: DirectoryLockDeps) {}

  async exclusively<T>(work: () => Promise<T>, waitMs?: number): Promise<T> {
    await this.deps.storage.ensureDirectory(this.deps.dir);
    const release = await this.deps.lock.acquire(waitMs);
    try {
      return await work();
    } finally {
      await release();
    }
  }
}
