import type { StoredUsage } from "../stored-usage.js";
import type { TranscriptPosition } from "../transcript-position.js";

export interface LoadedLedger {
  /** One record per `(tool, key)` across every partition. */
  readonly records: readonly StoredUsage[];
  /** Lines that were not records and are gone once the ledger is saved. */
  readonly skippedLines: number;
}

/** The ledger of billed calls, and where each transcript was read up to. */
export interface UsageLedger {
  /** Runs `work` while no other process writes the ledger. */
  exclusively<T>(work: () => Promise<T>): Promise<T>;
  load(): Promise<LoadedLedger>;
  /** Makes the ledger hold exactly these records. A partition that already holds what it
   * should is not touched. */
  save(records: readonly StoredUsage[]): Promise<void>;
  positions(): Promise<ReadonlyMap<string, TranscriptPosition>>;
  savePositions(positions: ReadonlyMap<string, TranscriptPosition>): Promise<void>;
  /** Forgets where every transcript was read up to, so the next ingest reads them whole. */
  resetPositions(): Promise<void>;
}
