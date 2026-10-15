import type { StoredUsage } from "../stored-usage.js";
import type { TranscriptPosition } from "../transcript-position.js";

/** A partition is named by its key: `YYYY-MM-DD` for a day, `YYYY-MM` for a month as an
 * earlier version wrote it. */
export interface LoadedLedger {
  /** One record per `(tool, key)` across every partition read. */
  readonly records: readonly StoredUsage[];
  /** Lines that were not records and are gone once their partition is saved. */
  readonly skippedLines: number;
  /** The partitions read that held one: saving them repairs them. */
  readonly damaged: ReadonlySet<string>;
  /** The partitions read that are not in canonical daily form: every monthly one, and every
   * one holding a call twice or a call another partition read also holds. Saving them settles
   * them. */
  readonly unsettled: ReadonlySet<string>;
}

/** The ledger of billed calls, and where each transcript was read up to. */
export interface UsageLedger {
  /** Runs `work` while no other process writes the ledger. */
  exclusively<T>(work: () => Promise<T>): Promise<T>;
  /** Every partition, daily and monthly. Given `days`, only those days, plus, for each month
   * one of them falls in that still has its monthly partition, that partition and every day
   * of the month: a half-finished split may hold a better snapshot in a day. */
  load(days?: ReadonlySet<string>): Promise<LoadedLedger>;
  /** Makes the ledger hold exactly these records, every other partition removed. A partition
   * that already holds what it should is not touched. Given `partitions`, a day is written
   * from `records`, or removed when they hold none for it; a month has each of its days
   * written from `records`, each of its days on disk they hold none for removed, then its
   * monthly partition removed, last. No other partition is read: the caller vouches that the
   * rest is as it was. */
  save(records: readonly StoredUsage[], partitions?: ReadonlySet<string>): Promise<void>;
  positions(): Promise<ReadonlyMap<string, TranscriptPosition>>;
  savePositions(positions: ReadonlyMap<string, TranscriptPosition>): Promise<void>;
}
