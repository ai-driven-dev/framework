import type { Environment } from "../../../shared/ports/environment.js";
import type { NotStoredReason } from "../contract/repository-resolution.js";
import { MEASUREMENT_SWITCH, measurementRefused } from "../domain/telemetry-consent.js";
import type { TranscriptPosition } from "../domain/transcript-position.js";
import type { UsageLedger } from "../ports/usage-ledger.js";
import type { DirectoryResolver } from "./directory-resolver.use-case.js";
import { storeCalls } from "./ledger-upkeep.js";
import type { ReadUsage, ReadUsageResult } from "./read-usage.use-case.js";
import type { ResolutionRun } from "./resolution-run.js";
import type { SnapshotBindings } from "./snapshot-bindings.use-case.js";
import { judgeReading, NOT_STORED, type Verdicts } from "./usage-judgement.js";

export interface IngestUsageResult {
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
  /** Sources that could not be read, named; the others were read and stored all the same. Their
   * transcripts keep their position, so they are read again by the next ingest. */
  readonly unreadable: readonly string[];
}

/** How far a file's modification time may lag the clock that stamps calls: coarse kernel
 * ticks, 2 s on FAT, a network file system's own clock. A transcript last written longer than
 * this before the first interval opened holds nothing that could be stored. */
const FILE_CLOCK_MARGIN_MS = 24 * 60 * 60 * 1000;

export interface IngestOptions {
  readonly environment: Environment;
}

/** A transcript only grows, so where its last line ends follows from its size: a file read
 * again at the same size and identity moved nowhere. */
function moved(before: TranscriptPosition | undefined, now: TranscriptPosition): boolean {
  return before === undefined || before.size !== now.size || before.identity !== now.identity;
}

/** What an ingest kept, and what is left to do once the resolutions are. */
interface Kept extends Verdicts {
  readonly reading: ReadUsageResult;
  readonly movedPaths: readonly string[];
  readonly stored: { added: number; updated: number; skippedLines: number };
  readonly consentLogDamaged: boolean;
}

interface IngestUsageDeps {
  /** One per tool measured: adding a tool is its format and its transcripts, here. */
  readonly readers: readonly ReadUsage[];
  readonly ledger: UsageLedger;
  readonly directories: DirectoryResolver;
  readonly snapshots: SnapshotBindings;
  readonly options: IngestOptions;
}

/** Reads what every transcript gained since the last ingest and stores the billed calls of the
 * projects that opted in, one record per call. Safe to run any number of times, from any
 * number of processes. */
export class IngestUsage {
  constructor(private readonly deps: IngestUsageDeps) {}

  async execute(): Promise<IngestUsageResult> {
    if (measurementRefused(this.deps.options.environment.get(MEASUREMENT_SWITCH))) {
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
        unreadable: [],
      };
    }
    return this.deps.ledger.exclusively(() => this.ingest());
  }

  private async ingest(): Promise<IngestUsageResult> {
    const before = await this.deps.ledger.positions();
    const kept = await this.deps.directories.execute((resolver) => this.keep(resolver, before));
    let snapshots = 0;
    for (const [repositoryId, root] of kept.live) {
      snapshots += await this.deps.snapshots.execute({ repositoryId, root });
    }
    await this.savePositions(before, kept);
    const { reading, stored } = kept;
    return {
      refused: false,
      filesRead: kept.movedPaths.filter((path) => !reading.skipped.has(path)).length,
      added: stored.added,
      updated: stored.updated,
      unrecognised: reading.unrecognised.length,
      skippedLedgerLines: stored.skippedLines,
      snapshots,
      notStored: kept.notStored,
      consentLogDamaged: kept.consentLogDamaged,
      oldestTranscriptAt: reading.oldestTranscriptAt,
      unreadable: reading.unreadable,
    };
  }

  /** The reading judged call by call and stored, with the resolutions it needed. */
  private async keep(
    resolver: ResolutionRun,
    before: ReadonlyMap<string, TranscriptPosition>
  ): Promise<Kept> {
    // The consent log first: a transcript last written before any interval opened is not read.
    const reading = await this.readAll(before, resolver.coveredFrom - FILE_CLOCK_MARGIN_MS);
    const movedPaths = [...reading.positions]
      .filter(([path, now]) => moved(before.get(path), now))
      .map(([path]) => path);
    const verdicts = await judgeReading(resolver, reading);
    const stored =
      verdicts.toStore.length > 0
        ? await storeCalls(this.deps.ledger, verdicts.toStore)
        : { added: 0, updated: 0, skippedLines: 0 };
    if (verdicts.leftOut.length > 0) await this.deps.ledger.leftOut.add(verdicts.leftOut);
    return {
      ...verdicts,
      reading,
      movedPaths,
      stored,
      consentLogDamaged: resolver.consentLogDamaged,
    };
  }

  /** Last, so a crash before it only means the same lines are read again. */
  private async savePositions(
    before: ReadonlyMap<string, TranscriptPosition>,
    kept: Kept
  ): Promise<void> {
    const positions = new Map(kept.reading.positions);
    for (const path of kept.held) {
      const was = before.get(path);
      if (was === undefined) positions.delete(path);
      else positions.set(path, was);
    }
    if (kept.movedPaths.length > 0) await this.deps.ledger.savePositions(positions);
  }

  /** Every tool's reading as one. Each tool hands back its own files' positions only, laid over
   * the ones held, so a file no longer listed keeps its place and no tool undoes another's. */
  private async readAll(
    before: ReadonlyMap<string, TranscriptPosition>,
    coveredFrom: number
  ): Promise<ReadUsageResult> {
    const readings = await Promise.all(
      this.deps.readers.map((reader) => reader.execute({ since: before, writtenFrom: coveredFrom }))
    );
    const oldest = readings.flatMap((reading) => reading.oldestTranscriptAt ?? []).sort();
    return {
      calls: readings.flatMap((reading) => reading.calls),
      positions: new Map([...before, ...readings.flatMap((reading) => [...reading.positions])]),
      unrecognised: readings.flatMap((reading) => reading.unrecognised),
      dropped: readings.flatMap((reading) => reading.dropped),
      oldestTranscriptAt: oldest[0] ?? null,
      skipped: new Set(readings.flatMap((reading) => [...reading.skipped])),
      unreadable: readings.flatMap((reading) => reading.unreadable),
    };
  }
}
