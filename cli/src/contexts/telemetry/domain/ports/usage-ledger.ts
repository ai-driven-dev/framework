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

/** Calls kept by day, folded at read: what a fold and a settle need. */
export interface DayLedger {
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
}

/** What is left out with no day: a call with no usable time, a transcript line that is no
 * usage line. */
export type NoDayReason = "undated" | "unrecognised";

/** One thing left out with no day, named by what it is: a call by its tool and key, a line by
 * its text. */
export interface NoDayEntry {
  readonly reason: NoDayReason;
  readonly of: string;
}

/** What ingests read and did not store, so a report run later still says it. A call with a day
 * is kept by day, as the ledger keeps its own, with nothing of it but its tool, key, agent, day
 * and the reason (see `leftOutOf`). What has no day is kept once, by a hash of what it is. */
export interface LeftOutLedger extends DayLedger {
  /** Adds these; one already held is not added again. */
  addNoDay(entries: readonly NoDayEntry[]): Promise<void>;
  /** How many are held, by reason. */
  noDay(): Promise<Readonly<Record<NoDayReason, number>>>;
}

/** The ledger of billed calls, what was left out of it, and where each transcript was read up
 * to. */
export interface UsageLedger extends DayLedger {
  /** Runs `work` while no other process writes the ledger, what it left out included. */
  exclusively<T>(work: () => Promise<T>): Promise<T>;
  readonly leftOut: LeftOutLedger;
  positions(): Promise<ReadonlyMap<string, TranscriptPosition>>;
  savePositions(positions: ReadonlyMap<string, TranscriptPosition>): Promise<void>;
}
