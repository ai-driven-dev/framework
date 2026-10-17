import { isRequestless, requestlessCallOf } from "../domain/formats/claude-transcript-usage.js";
import type { LeftOutEntry, UsageLedger } from "../domain/ports/usage-ledger.js";
import type { NotStoredReason } from "../domain/repository-resolution.js";
import { dayOf, type StoredUsage } from "../domain/stored-usage.js";
import type { TranscriptPosition } from "../domain/transcript-position.js";
import type { UsageRecord } from "../domain/usage-record.js";
import type { DirectoryOutcome, DirectoryResolver, ResolutionRun } from "./directory-resolver.js";
import { storeCalls } from "./ledger-upkeep.js";
import type { ReadUsageUseCase, UsageReading } from "./read-usage-use-case.js";
import type { SnapshotBindingsUseCase } from "./snapshot-bindings-use-case.js";

export interface IngestResult {
  /** `AIDD_TELEMETRY=0`: nothing was read, nothing was written. */
  readonly refused: boolean;
  /** Transcripts that were new or had grown since the last ingest. */
  readonly filesRead: number;
  readonly added: number;
  readonly updated: number;
  /** Shapes the reader met and did not recognise. */
  readonly unrecognised: number;
  /** Lines of the partitions this ingest read that were not records: its window only. */
  readonly skippedLedgerLines: number;
  /** Branch declarations newly snapshotted. */
  readonly snapshots: number;
  /** Billed calls, by the reason they were not stored. */
  readonly notStored: Readonly<Record<NotStoredReason, number>>;
  /** A line of `ledger/consents.jsonl` was not an event: nothing is stored, on any run, until
   * it is recovered. */
  readonly consentLogDamaged: boolean;
  /** When the oldest transcript still on disk was last written: how far back history can be
   * read. `null` when there is none, or nothing was read. */
  readonly oldestTranscriptAt: string | null;
}

const NOT_STORED: Readonly<Record<NotStoredReason, number>> = {
  "outside-repo": 0,
  "never-seen-alive": 0,
  "no-consent": 0,
  "consent-closed": 0,
  "unreadable-consent": 0,
  "no-cwd": 0,
  undated: 0,
};

/** How far a file's modification time may lag the clock that stamps calls: coarse kernel
 * ticks, 2 s on FAT, a network file system's own clock. A transcript last written longer than
 * this before the first interval opened holds nothing that could be stored. */
const FILE_CLOCK_MARGIN_MS = 24 * 60 * 60 * 1000;

export interface IngestOptions {
  /** `AIDD_TELEMETRY=0`, read by the composition root. */
  readonly refusedByEnvironment: boolean;
}

function moved(before: TranscriptPosition | undefined, now: TranscriptPosition): boolean {
  return (
    before === undefined ||
    before.offset !== now.offset ||
    before.size !== now.size ||
    before.identity !== now.identity
  );
}

/** Reads what every transcript gained since the last ingest and stores the billed calls of the
 * projects that opted in, one record per call. Safe to run any number of times, from any
 * number of processes. */
export class IngestUsageUseCase {
  constructor(
    /** One per tool measured: adding a tool is its format and its transcripts, here. */
    private readonly readers: readonly ReadUsageUseCase[],
    private readonly ledger: UsageLedger,
    private readonly directories: DirectoryResolver,
    private readonly snapshots: SnapshotBindingsUseCase,
    private readonly options: IngestOptions,
    /** Brings stored data to today's key and id rules first (`StoredUsageMigration`). */
    private readonly migration: { execute(): Promise<void> }
  ) {}

  async execute(): Promise<IngestResult> {
    if (this.options.refusedByEnvironment) {
      return {
        refused: true,
        filesRead: 0,
        added: 0,
        updated: 0,
        unrecognised: 0,
        skippedLedgerLines: 0,
        snapshots: 0,
        notStored: NOT_STORED,
        consentLogDamaged: false,
        oldestTranscriptAt: null,
      };
    }
    return this.ledger.exclusively(() => this.ingest());
  }

  private async ingest(): Promise<IngestResult> {
    // Stored data first brought to the rules of now, before anything is added to it.
    await this.migration.execute();
    const before = await this.ledger.positions();
    // The consent log first: a transcript last written before any interval opened is not read.
    const resolver = await this.directories.open();
    const reading = await this.readAll(before, resolver.coveredFrom - FILE_CLOCK_MARGIN_MS);
    const movedPaths = [...reading.positions]
      .filter(([path, now]) => moved(before.get(path), now))
      .map(([path]) => path);
    const filesRead = movedPaths.filter((path) => !reading.skipped.has(path)).length;

    const notStored = { ...NOT_STORED };
    const toStore: StoredUsage[] = [];
    // What was measured and cannot be stored is kept, so a later report says it, whoever ran
    // this: only of a clone that consents, at the thing's own time or, with none, now.
    const leftOut: LeftOutEntry[] = [];
    // A transcript holding what a clone that consents could not be read for is read again
    // next time; a hold that could never end (no clone known to consent there, a consent log
    // that stays damaged until `forget`) is not taken.
    const held = new Set<string>();
    const hold = (path: string | undefined, cwd: string, at: string) => {
      if (!resolver.consentLogDamaged && resolver.mayConsent(cwd, at)) held.add(path ?? "");
    };
    const measured = async (cwd: string | null, at: string | null, path: string | undefined) => {
      if (cwd === null) return false;
      const when = at !== null && dayOf(at) !== null ? at : resolver.now;
      const outcome = await resolver.resolve(cwd, when);
      if ("skipped" in outcome && outcome.skipped === "unreadable-consent") hold(path, cwd, when);
      return "stored" in outcome;
    };
    for (const { line, cwd, at, path } of reading.dropped) {
      if (await measured(cwd, at, path)) leftOut.push({ reason: "unrecognised", of: line });
    }
    const live = new Map<string, string>();
    for (const record of reading.records) {
      const outcome = await this.outcomeOf(record, resolver);
      if ("skipped" in outcome) {
        const { skipped } = outcome;
        notStored[skipped] += 1;
        if (skipped === "unreadable-consent") {
          hold(reading.fileOf.get(record), record.cwd ?? "", record.at);
        }
        if (
          skipped === "undated" &&
          (await measured(record.cwd, null, reading.fileOf.get(record)))
        ) {
          leftOut.push({ reason: "undated", of: `${record.tool}\u0000${record.key}` });
        }
        continue;
      }
      if (isRequestless(record)) {
        leftOut.push({ reason: "requestless", of: requestlessCallOf(record) });
        continue;
      }
      toStore.push({ ...record, repository_id: outcome.stored.repository_id });
      if (outcome.live) live.set(outcome.stored.repository_id, outcome.stored.root);
    }

    const stored =
      toStore.length > 0
        ? await storeCalls(this.ledger, toStore)
        : { added: 0, updated: 0, skippedLines: 0 };
    if (leftOut.length > 0) await this.ledger.leftOut.add(leftOut);
    await resolver.close();
    const consentLogDamaged = resolver.consentLogDamaged;

    let snapshots = 0;
    for (const [repositoryId, root] of live) {
      snapshots += await this.snapshots.execute(repositoryId, root);
    }

    // Last, so a crash before it only means the same lines are read again.
    const positions = new Map(reading.positions);
    for (const path of held) {
      const was = before.get(path);
      if (was === undefined) positions.delete(path);
      else positions.set(path, was);
    }
    if (movedPaths.length > 0) await this.ledger.savePositions(positions);

    return {
      refused: false,
      filesRead,
      added: stored.added,
      updated: stored.updated,
      unrecognised: reading.unrecognised.length,
      skippedLedgerLines: stored.skippedLines,
      snapshots,
      notStored,
      consentLogDamaged,
      oldestTranscriptAt: reading.oldestTranscriptAt,
    };
  }

  /** Every tool's reading as one. Each tool hands back its own files' positions only, laid over
   * the ones held, so a file no longer listed keeps its place and no tool undoes another's. */
  private async readAll(
    before: ReadonlyMap<string, TranscriptPosition>,
    coveredFrom: number
  ): Promise<UsageReading> {
    const readings = await Promise.all(
      this.readers.map((reader) => reader.execute(before, coveredFrom))
    );
    const oldest = readings.flatMap((reading) => reading.oldestTranscriptAt ?? []).sort();
    return {
      records: readings.flatMap((reading) => reading.records),
      positions: new Map([...before, ...readings.flatMap((reading) => [...reading.positions])]),
      unrecognised: readings.flatMap((reading) => reading.unrecognised),
      fileOf: new Map(readings.flatMap((reading) => [...reading.fileOf])),
      dropped: readings.flatMap((reading) => reading.dropped),
      oldestTranscriptAt: oldest[0] ?? null,
      skipped: new Set(readings.flatMap((reading) => [...reading.skipped])),
    };
  }

  /** A call with no time has no day to be kept in, and one with no directory has no
   * repository to be tied to. */
  private async outcomeOf(record: UsageRecord, resolver: ResolutionRun): Promise<DirectoryOutcome> {
    if (dayOf(record.at) === null) return { skipped: "undated" };
    if (record.cwd === null) return { skipped: "no-cwd" };
    return resolver.resolve(record.cwd, record.at);
  }
}
