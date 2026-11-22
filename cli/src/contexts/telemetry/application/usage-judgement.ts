import type { NotStoredReason } from "../contract/repository-resolution.js";
import type { UsageRecord } from "../contract/usage-record.js";
import type { DirectoryOutcome, ResolutionRun } from "../domain/resolution/resolution-run.js";
import {
  dayOf,
  isRequestless,
  requestlessCallOf,
  type StoredUsage,
} from "../domain/stored-usage.js";
import type { LeftOutEntry } from "../ports/usage-ledger.js";
import type { ReadUsageResult } from "./read-usage.use-case.js";

export const NOT_STORED: Readonly<Record<NotStoredReason, number>> = {
  "outside-repo": 0,
  "never-seen-alive": 0,
  "no-consent": 0,
  "consent-closed": 0,
  "unreadable-consent": 0,
  "no-cwd": 0,
  undated: 0,
};

/** What one ingest decided about the calls it read, before anything is kept. */
export interface Verdicts {
  readonly notStored: Record<NotStoredReason, number>;
  readonly toStore: StoredUsage[];
  /** What was measured and cannot be stored is kept, so a later report says it, whoever ran
   * this: only of a clone that consents, at the thing's own time or, with none, now. */
  readonly leftOut: LeftOutEntry[];
  /** A transcript holding what a clone that consents could not be read for is read again next
   * time; a hold that could never end (no clone known to consent there, a consent log that
   * stays damaged until `forget`) is not taken. */
  readonly held: Set<string>;
  /** The root of each repository a call was stored for, alive now. */
  readonly live: Map<string, string>;
}

type Skipped = Extract<DirectoryOutcome, { skipped: NotStoredReason }>;

/** The call a verdict is given on: the record, the transcript it came from, and where it was
 * made. */
interface JudgedCall {
  readonly record: UsageRecord;
  readonly path: string | undefined;
  readonly outcome: DirectoryOutcome;
}

/** Judges every call and every unrecognised line of a reading against the resolutions of a
 * run, and says what is stored, what is left out and what must be read again. */
export async function judgeReading(
  resolver: ResolutionRun,
  reading: ReadUsageResult
): Promise<Verdicts> {
  const verdicts: Verdicts = {
    notStored: { ...NOT_STORED },
    toStore: [],
    leftOut: [],
    held: new Set(),
    live: new Map(),
  };
  await judgeDropped(resolver, verdicts, reading.dropped);
  for (const record of reading.records) {
    const outcome = await outcomeOf(resolver, record);
    await judgeCall(resolver, verdicts, { record, path: reading.fileOf.get(record), outcome });
  }
  return verdicts;
}

/** A line no reader recognised is left out, once the clone it was written in is known to
 * consent. */
async function judgeDropped(
  resolver: ResolutionRun,
  verdicts: Verdicts,
  dropped: ReadUsageResult["dropped"]
): Promise<void> {
  for (const { line, cwd, at, path } of dropped) {
    if (cwd === null) continue;
    const when = at !== null && dayOf(at) !== null ? at : resolver.now;
    const outcome = await resolver.resolve(cwd, when);
    holdIfUnreadable(verdicts, outcome, path);
    if ("stored" in outcome) verdicts.leftOut.push({ reason: "unrecognised", of: line });
  }
}

async function judgeCall(
  resolver: ResolutionRun,
  verdicts: Verdicts,
  call: JudgedCall
): Promise<void> {
  const { record, outcome } = call;
  if ("skipped" in outcome) return judgeSkipped(resolver, verdicts, { ...call, outcome });
  if (isRequestless(record)) {
    verdicts.leftOut.push({ reason: "requestless", of: requestlessCallOf(record) });
    return;
  }
  verdicts.toStore.push({ ...record, repository_id: outcome.stored.repository_id });
  if (outcome.live) verdicts.live.set(outcome.stored.repository_id, outcome.stored.root);
}

/** A call with no time is measured where it was made, so that what it cost is still said. */
async function judgeSkipped(
  resolver: ResolutionRun,
  verdicts: Verdicts,
  { record, path, outcome }: JudgedCall & { readonly outcome: Skipped }
): Promise<void> {
  verdicts.notStored[outcome.skipped] += 1;
  holdIfUnreadable(verdicts, outcome, path);
  if (outcome.skipped !== "undated" || record.cwd === null) return;
  const measured = await resolver.resolve(record.cwd, resolver.now);
  holdIfUnreadable(verdicts, measured, path);
  if ("stored" in measured) {
    verdicts.leftOut.push({ reason: "undated", of: `${record.tool}\u0000${record.key}` });
  }
}

function holdIfUnreadable(
  verdicts: Verdicts,
  outcome: DirectoryOutcome,
  path: string | undefined
): void {
  if ("skipped" in outcome && outcome.skipped === "unreadable-consent" && outcome.mayConsent) {
    verdicts.held.add(path ?? "");
  }
}

/** A call with no time has no day to be kept in, and one with no directory has no repository to
 * be tied to. */
async function outcomeOf(resolver: ResolutionRun, record: UsageRecord): Promise<DirectoryOutcome> {
  if (dayOf(record.at) === null) return { skipped: "undated" };
  if (record.cwd === null) return { skipped: "no-cwd" };
  return resolver.resolve(record.cwd, record.at);
}
