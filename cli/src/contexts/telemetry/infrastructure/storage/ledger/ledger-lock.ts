import { rm, writeFile } from "node:fs/promises";
import { isErrnoException } from "../../../../../shared/domain/reading/json-file.js";
import { plainObjectIn } from "../../../../../shared/domain/reading/plain-object.js";
import { isCount, isInstant } from "../../../domain/read-back.js";
import { modifiedAtIfPresent, readTextIfPresent } from "../../reading/text-file.js";

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
  /** What the lock guards, as an error names it. */
  readonly name: string;
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
  name: "telemetry ledger",
};

interface Holder {
  /** `null` when the lock's content could not be read and only its file's age is known. */
  readonly pid: number | null;
  readonly createdAt: number;
}

function holderIn(text: string | null): Holder | null {
  const lock = plainObjectIn(text);
  const pid = lock?.pid;
  const createdAt = lock?.created_at;
  return isCount(pid) && isInstant(createdAt) ? { pid, createdAt: Date.parse(createdAt) } : null;
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
    while (!(await this.attempt(deadline)));
    return () => this.release();
  }

  /** One try at the lock: whether it was taken. A try that has to wait has waited. A lock
   * released while looking is cleared as a stale one is, and tried again at once. */
  private async attempt(deadline: number): Promise<boolean> {
    const late = this.options.now() >= deadline;
    const created = await this.tryCreate(late);
    if (created === "removing") return this.waited();
    if (created) return true;
    const holder = await this.holder();
    if (holder === null || this.isStale(holder)) {
      await this.clear();
      return false;
    }
    if (late) throw this.lockedBy(holder);
    return this.waited();
  }

  private async waited(): Promise<false> {
    await this.options.sleep(this.options.pollMs);
    return false;
  }

  /** Another process may have cleared it first. */
  private clear(): Promise<void> {
    return rm(this.path, { force: true });
  }

  private lockedBy(holder: Holder): Error {
    return new Error(
      `The ${this.options.name} is locked by process ${holder.pid ?? "unknown"}, which is still running. ` +
        `Wait for it to finish, or remove ${this.path} if that process is not an aidd command.`
    );
  }

  /** Whether the lock was taken, or `removing` while Windows still deletes the last one. */
  private async tryCreate(pastDeadline: boolean): Promise<boolean | "removing"> {
    const created = new Date(this.options.now()).toISOString();
    try {
      await writeFile(this.path, JSON.stringify({ pid: this.options.pid, created_at: created }), {
        flag: "wx",
        mode: 0o600,
      });
      return true;
    } catch (error) {
      if (isErrnoException(error) && error.code === "EEXIST") return false;
      // Windows refuses a file another handle is still deleting, until that handle closes.
      if (isErrnoException(error) && error.code === "EPERM" && !pastDeadline) return "removing";
      throw error;
    }
  }

  /** Who holds the lock, or `null` when it was released while looking. A lock whose content
   * cannot be read is judged by its file's age. */
  private async holder(): Promise<Holder | null> {
    const written = holderIn(await readTextIfPresent(this.path));
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
    if (holder?.pid === this.options.pid) await this.clear();
  }
}
