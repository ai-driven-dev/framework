import type { StoredUsage } from "../stored-usage.js";
import type { TranscriptPosition } from "../transcript-position.js";

/** A partition is named by its key: `YYYY-MM-DD` for a day, `YYYY-MM` for a month as an
 * earlier version wrote it. */
export interface LoadedLedger {
  /** One record per `(tool, key)` across every partition read. */
  readonly records: readonly StoredUsage[];
  /** Lines that were not records. Saving keeps them: a newer version may have written them. */
  readonly skippedLines: number;
  /** The partitions read that held one: saving them puts them in canonical order. */
  readonly damaged: ReadonlySet<string>;
  /** The partitions read that are not in canonical daily form: every monthly one, and every
   * one holding a call twice or a call another partition read also holds. Saving them settles
   * them. */
  readonly unsettled: ReadonlySet<string>;
}

/** What is measured and cannot be stored: a call with no usable time, a transcript line that is
 * no usage line. Only of a clone that consents, at the time of the thing or, with none, of the
 * read: a clone that never opted in, or work after `off`, leaves nothing here. */
export type LeftOutReason = "undated" | "unrecognised";

/** One thing left out, named by what it is: a call by its tool and key, a line by its text. */
export interface LeftOutEntry {
  readonly reason: LeftOutReason;
  readonly of: string;
}

/** What ingests measured and could not store, so a report run later still says it. Each thing
 * is kept once, as a hash: never a key or a line in clear. */
export interface LeftOutStore {
  /** Adds these; one already held is not added again. */
  add(entries: readonly LeftOutEntry[]): Promise<void>;
  /** How many are held, by reason. */
  counts(): Promise<Readonly<Record<LeftOutReason, number>>>;
}

/** The ledger of billed calls, what was measured and left out of it, and where each transcript
 * was read up to. */
export interface UsageLedger {
  readonly leftOut: LeftOutStore;
  /** Runs `work` while no other process writes the ledger. */
  exclusively<T>(work: () => Promise<T>): Promise<T>;
  /** Every partition, daily and monthly. Given `holds`, a test on a `YYYY-MM-DD` day, only the
   * days it holds, plus every monthly partition it holds one of the calendar days of, read with
   * every day of that month: a half-finished split may hold a better snapshot in a day. What a
   * load costs is the partitions on disk, never how many days the test holds. */
  load(holds?: (day: string) => boolean): Promise<LoadedLedger>;
  /** Makes the ledger hold exactly these records, every other partition removed. A partition
   * that already holds what it should is not touched. Given `partitions`, a day is written
   * from `records`, or removed when they hold none for it; a month has each of its days
   * written from `records`, each of its days on disk they hold none for removed, then its
   * monthly partition removed, last. No other partition is read: the caller vouches that the
   * rest is as it was. A line that is not a record is never removed: it stays in its day,
   * after the records, in text order and once, and a month's goes to its first day. */
  save(records: readonly StoredUsage[], partitions?: ReadonlySet<string>): Promise<void>;
  positions(): Promise<ReadonlyMap<string, TranscriptPosition>>;
  savePositions(positions: ReadonlyMap<string, TranscriptPosition>): Promise<void>;
}
