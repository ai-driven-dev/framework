import type { LeftOutReason } from "../contract/repository-resolution.js";
import type { StoredUsage } from "../domain/stored-usage.js";
import type { TranscriptPosition } from "../domain/transcript-position.js";

/** A partition is a day, named `YYYY-MM-DD`. */
export interface LoadedLedger {
  /** One record per `(tool, key)` across every partition read. */
  readonly records: readonly StoredUsage[];
  /** Lines that were not records. Saving keeps them: another version may have written them. */
  readonly skippedLines: number;
  /** The partitions read that held one: saving them puts them in canonical order. */
  readonly damaged: ReadonlySet<string>;
  /** The partitions read that are not in canonical form: every one holding a call twice, a
   * call another partition read also holds. Saving them settles them. */
  readonly unsettled: ReadonlySet<string>;
}

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
  /** Every partition. Given `holds`, a test on a `YYYY-MM-DD` day, only the days it holds. What
   * a load costs is the partitions on disk, never how many days the test holds. */
  load(holds?: (day: string) => boolean): Promise<LoadedLedger>;
  /** Makes the ledger hold exactly these records, every other partition removed. A partition
   * that already holds what it should is not touched. Given `partitions`, a day is written
   * from `records`, or removed when they hold none for it. No other partition is read: the
   * caller vouches that the rest is as it was. A line that is not a record is never removed:
   * it stays in its day, after the records, in text order and once. */
  save(records: readonly StoredUsage[], partitions?: ReadonlySet<string>): Promise<void>;
  positions(): Promise<ReadonlyMap<string, TranscriptPosition>>;
  savePositions(positions: ReadonlyMap<string, TranscriptPosition>): Promise<void>;
}
