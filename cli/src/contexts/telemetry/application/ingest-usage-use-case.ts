import type { UsageLedger } from "../domain/ports/usage-ledger.js";
import type { NotStoredReason } from "../domain/repository-resolution.js";
import { monthOf, type StoredUsage, upsertUsage } from "../domain/stored-usage.js";
import type { TranscriptPosition } from "../domain/transcript-position.js";
import type { UsageRecord } from "../domain/usage-record.js";
import type { DirectoryOutcome, DirectoryResolver, ResolutionRun } from "./directory-resolver.js";
import type { ReadClaudeUsageUseCase } from "./read-claude-usage-use-case.js";
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
  /** Lines of the ledger that were not records. */
  readonly skippedLedgerLines: number;
  /** Branch declarations newly snapshotted. */
  readonly snapshots: number;
  /** Billed calls, by the reason they were not stored. */
  readonly notStored: Readonly<Record<NotStoredReason, number>>;
}

const NOT_STORED: Readonly<Record<NotStoredReason, number>> = {
  "outside-repo": 0,
  "never-seen-alive": 0,
  "no-consent": 0,
  "unreadable-consent": 0,
  "no-cwd": 0,
  undated: 0,
};

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
    private readonly reader: ReadClaudeUsageUseCase,
    private readonly ledger: UsageLedger,
    private readonly directories: DirectoryResolver,
    private readonly snapshots: SnapshotBindingsUseCase,
    private readonly options: IngestOptions
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
      };
    }
    return this.ledger.exclusively(() => this.ingest());
  }

  private async ingest(): Promise<IngestResult> {
    const before = await this.ledger.positions();
    const reading = await this.reader.execute(before);
    const filesRead = [...reading.positions].filter(([path, now]) =>
      moved(before.get(path), now)
    ).length;

    const resolver = await this.directories.open();
    const notStored = { ...NOT_STORED };
    const toStore: StoredUsage[] = [];
    const live = new Map<string, string>();
    for (const record of reading.records) {
      const outcome = await this.outcomeOf(record, resolver);
      if ("skipped" in outcome) {
        notStored[outcome.skipped] += 1;
        continue;
      }
      toStore.push({ ...record, repository_id: outcome.stored.repository_id });
      if (outcome.live) live.set(outcome.stored.repository_id, outcome.stored.root);
    }

    let added = 0;
    let updated = 0;
    let skippedLedgerLines = 0;
    if (toStore.length > 0) {
      const held = await this.ledger.load();
      skippedLedgerLines = held.skippedLines;
      const merged = upsertUsage(held.records, toStore);
      added = merged.added;
      updated = merged.updated;
      if (added + updated > 0) await this.ledger.save(merged.records);
    }
    await resolver.close();

    let snapshots = 0;
    for (const [repositoryId, root] of live) {
      snapshots += await this.snapshots.execute(repositoryId, root);
    }

    // Last, so a crash before it only means the same lines are read again.
    if (filesRead > 0) await this.ledger.savePositions(reading.positions);

    return {
      refused: false,
      filesRead,
      added,
      updated,
      unrecognised: reading.unrecognised.length,
      skippedLedgerLines,
      snapshots,
      notStored,
    };
  }

  /** A call with no time has no month to be kept in, and one with no directory has no
   * repository to be tied to. */
  private async outcomeOf(record: UsageRecord, resolver: ResolutionRun): Promise<DirectoryOutcome> {
    if (monthOf(record.at) === null) return { skipped: "undated" };
    if (record.cwd === null) return { skipped: "no-cwd" };
    return resolver.resolve(record.cwd);
  }
}
