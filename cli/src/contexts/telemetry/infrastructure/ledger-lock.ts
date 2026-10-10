import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isErrnoException, tryParseJson } from "../../../kernel/reading/json-file.js";
import { asPlainObject } from "../../../kernel/reading/plain-object.js";
import { modifiedAtIfPresent, readTextIfPresent } from "../../../kernel/reading/text-file.js";
import type { PrivateStorage } from "../domain/ports/private-storage.js";

export interface LockOptions {
  readonly pid: number;
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
  readonly isAlive: (pid: number) => boolean;
  /** A lock older than this is cleared whoever claims to hold it. */
  readonly staleAfterMs: number;
  /** How long to wait on a lock that is held. */
  readonly waitMs: number;
  readonly pollMs: number;
}

/** `kill(pid, 0)` sends nothing: it only asks whether the process exists. A process of another
 * user answers EPERM, which is a yes. */
function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return isErrnoException(error) && error.code === "EPERM";
  }
}

const DEFAULTS: LockOptions = {
  pid: process.pid,
  now: () => Date.now(),
  sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
  isAlive: processIsAlive,
  staleAfterMs: 10 * 60_000,
  waitMs: 60_000,
  pollMs: 50,
};

interface Holder {
  /** `null` when the lock's content could not be read and only its file's age is known. */
  readonly pid: number | null;
  readonly createdAt: number;
}

function holderIn(text: string): Holder | null {
  const parsed = tryParseJson(text);
  const lock = parsed.ok ? asPlainObject(parsed.value) : null;
  const createdAt = Date.parse(String(lock?.created_at));
  return Number.isInteger(lock?.pid) && !Number.isNaN(createdAt)
    ? { pid: lock?.pid as number, createdAt }
    : null;
}

/** A lock on a file in a directory kept private, taken around some work. */
export class DirectoryLock {
  constructor(
    private readonly dir: string,
    private readonly file: string,
    private readonly storage: PrivateStorage,
    private readonly options: Partial<LockOptions>
  ) {}

  async exclusively<T>(work: () => Promise<T>): Promise<T> {
    await this.storage.ensureDirectory(this.dir);
    const release = await new LedgerLock(join(this.dir, this.file), this.options).acquire();
    try {
      return await work();
    } finally {
      await release();
    }
  }
}

/** A lock file holding the pid and creation time of its owner, created exclusively. The owner
 * of a lock that is gone (dead pid) or too old (a pid reused, a machine that slept) is not
 * waited for. Clearing a stale lock and taking it are two steps, so two processes that both
 * judge one lock stale can each take it in turn; what they write under it is idempotent. */
export class LedgerLock {
  private readonly options: LockOptions;

  constructor(
    private readonly path: string,
    options: Partial<LockOptions> = {}
  ) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** Resolves with the function that releases the lock. */
  async acquire(): Promise<() => Promise<void>> {
    const deadline = this.options.now() + this.options.waitMs;
    for (;;) {
      if (await this.tryCreate()) return () => this.release();
      const holder = await this.holder();
      if (holder === null) continue;
      if (this.isStale(holder)) {
        await rm(this.path, { force: true });
        continue;
      }
      if (this.options.now() >= deadline) {
        throw new Error(
          `The telemetry ledger is locked by process ${holder.pid ?? "unknown"}, which is still running. ` +
            `Wait for it to finish, or remove ${this.path} if that process is not an aidd ingest.`
        );
      }
      await this.options.sleep(this.options.pollMs);
    }
  }

  private async tryCreate(): Promise<boolean> {
    const created = new Date(this.options.now()).toISOString();
    try {
      await writeFile(this.path, JSON.stringify({ pid: this.options.pid, created_at: created }), {
        flag: "wx",
        mode: 0o600,
      });
      return true;
    } catch (error) {
      if (isErrnoException(error) && error.code === "EEXIST") return false;
      throw error;
    }
  }

  /** Who holds the lock, or `null` when it was released while looking. A lock whose content
   * cannot be read is judged by its file's age. */
  private async holder(): Promise<Holder | null> {
    const text = await readTextIfPresent(this.path);
    if (text === null) return null;
    const written = holderIn(text);
    if (written !== null) return written;
    const modifiedAt = await modifiedAtIfPresent(this.path);
    return modifiedAt === null ? null : { pid: null, createdAt: modifiedAt };
  }

  private isStale(holder: Holder): boolean {
    if (this.options.now() - holder.createdAt > this.options.staleAfterMs) return true;
    return holder.pid !== null && !this.options.isAlive(holder.pid);
  }

  /** Only the lock this process took: one cleared as stale and retaken by another is theirs. */
  private async release(): Promise<void> {
    const holder = await this.holder();
    if (holder?.pid === this.options.pid) await rm(this.path, { force: true });
  }
}
