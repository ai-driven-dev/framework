import { join } from "node:path";
import type { PrivateStorage } from "../../../ports/private-storage.js";
import { LedgerLock, type LockOptions } from "./ledger-lock.js";

/** A lock on a file in a directory kept private, taken around some work. */
export class DirectoryLock {
  constructor(
    private readonly dir: string,
    private readonly file: string,
    private readonly storage: PrivateStorage,
    private readonly options: Partial<LockOptions>
  ) {}

  async exclusively<T>(work: () => Promise<T>, waitMs?: number): Promise<T> {
    await this.storage.ensureDirectory(this.dir);
    const release = await new LedgerLock(join(this.dir, this.file), {
      ...this.options,
      ...(waitMs === undefined ? {} : { waitMs }),
    }).acquire();
    try {
      return await work();
    } finally {
      await release();
    }
  }
}
