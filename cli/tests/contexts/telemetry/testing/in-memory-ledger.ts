import { dayOf, type StoredUsage } from "../../../../src/contexts/telemetry/domain/stored-usage.js";
import type { TranscriptPosition } from "../../../../src/contexts/telemetry/domain/transcript-position.js";
import { foldUsage } from "../../../../src/contexts/telemetry/domain/usage-fold.js";
import type {
  LoadedLedger,
  UsageLedger,
} from "../../../../src/contexts/telemetry/ports/usage-ledger.js";
import { InMemoryLeftOut } from "./in-memory-left-out.js";

export class InMemoryLedger implements UsageLedger {
  records: StoredUsage[] = [];
  stored = new Map<string, TranscriptPosition>();
  /** Pass one array to several fakes to see the order they were used in. */
  readonly leftOut: InMemoryLeftOut;
  constructor(readonly events: string[] = []) {
    this.leftOut = new InMemoryLeftOut(events);
  }
  failSave = false;
  exclusiveRuns = 0;

  async exclusively<T>(work: () => Promise<T>): Promise<T> {
    this.exclusiveRuns += 1;
    this.events.push("lock");
    try {
      return await work();
    } finally {
      this.events.push("unlock");
    }
  }

  /** The window the last load was given; `undefined` when it read everything. */
  loadedWindow: ((day: string) => boolean) | undefined;

  async load(holds?: (day: string) => boolean): Promise<LoadedLedger> {
    this.events.push("load");
    this.loadedWindow = holds;
    const read =
      holds === undefined
        ? this.records
        : this.records.filter((record) => holds(dayOf(record.at) ?? ""));
    return {
      records: foldUsage(read),
      skippedLines: this.damaged.size,
      damaged: new Set(this.damaged),
      unsettled: new Set(this.unsettled),
    };
  }

  /** Partitions holding a line that is not a record. Saving one keeps it. */
  damaged = new Set<string>();
  /** Partitions not in canonical daily form. Saving one settles it. */
  unsettled = new Set<string>();
  savedPartitions: ReadonlySet<string> | undefined;

  /** Named partitions take their records from `records`; the rest keep theirs, as on disk. */
  async save(records: readonly StoredUsage[], partitions?: ReadonlySet<string>): Promise<void> {
    this.events.push("save");
    this.savedPartitions = partitions;
    if (this.failSave) throw new Error("disk full");
    const named = (record: StoredUsage): boolean => {
      const day = dayOf(record.at) ?? "";
      return partitions === undefined || partitions.has(day) || partitions.has(day.slice(0, 7));
    };
    this.records = foldUsage([
      ...this.records.filter((record) => !named(record)),
      ...records.filter(named),
    ]);
    for (const partition of partitions ?? [...this.unsettled]) this.unsettled.delete(partition);
  }

  async positions(): Promise<ReadonlyMap<string, TranscriptPosition>> {
    return new Map(this.stored);
  }

  async savePositions(positions: ReadonlyMap<string, TranscriptPosition>): Promise<void> {
    this.events.push("positions");
    this.stored = new Map(positions);
  }
}
