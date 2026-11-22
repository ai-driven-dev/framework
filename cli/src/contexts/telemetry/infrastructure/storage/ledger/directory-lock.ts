import { join } from "node:path";
import type { PrivateStorage } from "../../../../../shared/ports/private-storage.js";
import { LedgerLock, type LockOptions } from "./ledger-lock.js";

interface DirectoryLockDeps {
  readonly dir: string;
  readonly file: string;
  readonly storage: PrivateStorage;
  readonly options: Partial<LockOptions>;
}

/** A lock on a file in a directory kept private, taken around some work. */
export class DirectoryLock {
  constructor(private readonly deps: DirectoryLockDeps) {}

  async exclusively<T>(work: () => Promise<T>, waitMs?: number): Promise<T> {
    await this.deps.storage.ensureDirectory(this.deps.dir);
    const release = await new LedgerLock(join(this.deps.dir, this.deps.file), {
      ...this.deps.options,
      ...(waitMs === undefined ? {} : { waitMs }),
    }).acquire();
    try {
      return await work();
    } finally {
      await release();
    }
  }
}
