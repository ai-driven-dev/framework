import type { LoadedLedger, UsageLedger } from "../domain/ports/usage-ledger.js";
import { daysAround, type StoredUsage, upsertUsage } from "../domain/stored-usage.js";

export interface Stored {
  readonly added: number;
  readonly updated: number;
  /** Lines of the partitions read that were not records. */
  readonly skippedLines: number;
}

/** Folds incoming calls into the days around them, and rewrites only the days that changed,
 * plus any partition read that was damaged or not in daily form, so a month is split and a
 * torn line dropped once. Nothing outside the window is read, except a monthly file it
 * splits and every day of that month. Runs under the caller's lock. */
export async function storeCalls(
  ledger: UsageLedger,
  incoming: readonly StoredUsage[]
): Promise<Stored> {
  const days = daysAround(incoming);
  const held = await ledger.load((day) => days.has(day));
  const merged = upsertUsage(held.records, incoming);
  const partitions = new Set([...merged.days, ...held.damaged, ...held.unsettled]);
  if (partitions.size > 0) await ledger.save(merged.records, partitions);
  return { added: merged.added, updated: merged.updated, skippedLines: held.skippedLines };
}

/** Reads the partitions and rewrites, folded, each one read that is damaged or not in daily
 * form: a monthly one, or one holding a call another read also holds. With no test, it reads
 * every partition, and after it the ledger is byte-identical to a single ingest of the same
 * calls. With a test on the day, it reads and settles only what the ledger loads for it (see
 * `UsageLedger.load`), and leaves every other partition as it is. A settled day is not
 * touched. Runs under the caller's lock. */
export async function settleLedger(
  ledger: UsageLedger,
  holds?: (day: string) => boolean
): Promise<LoadedLedger> {
  const held = await ledger.load(holds);
  const partitions = new Set([...held.unsettled, ...held.damaged]);
  if (partitions.size > 0) await ledger.save(held.records, partitions);
  return held;
}
