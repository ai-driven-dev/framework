import type { PersonIdentityStore } from "../../domain/ports/identity/person-identity-store.js";
import type { UsageLedger } from "../../domain/ports/usage-ledger.js";
import { inPeriod, type Period } from "../../domain/report/period.js";
import {
  buildReport,
  type ReportAxis,
  type UsageReport,
} from "../../domain/report/usage-report.js";
import type { NotStoredReason } from "../../domain/repository-resolution.js";
import type { IngestUsageUseCase } from "../ingest-usage-use-case.js";
import type { DeclaredBindings } from "./declared-bindings.js";

export interface ReportRequest {
  readonly axis: ReportAxis;
  readonly period: Period;
}

/** What the figures rest on, so a reader can tell a small number from a missing one. */
export interface ReportCoverage {
  /** Transcripts read by this run: new, or grown since the last. */
  readonly filesRead: number;
  /** Billed calls in the report's period. */
  readonly records: number;
  /** Shapes this run met and did not recognise, so did not count. */
  readonly unrecognised: number;
  /** Billed calls this run read and did not store, by the reason. */
  readonly notStored: Readonly<Record<NotStoredReason, number>>;
  /** When the oldest transcript still on disk was last written: nothing older can be read. */
  readonly oldestTranscriptAt: string | null;
  /** Lines of the ledger that were not records. */
  readonly skippedLedgerLines: number;
}

export type ReportResult =
  | { readonly status: "refused" }
  | {
      readonly status: "reported";
      readonly period: Period;
      readonly report: UsageReport;
      readonly coverage: ReportCoverage;
    };

/** Reads what is new, then answers what the stored calls consumed in a period, split along one
 * axis. The ledger holds facts only: what a call belongs to is worked out here, every time, from
 * what people declared, so a declaration made later moves earlier work. */
export class ReportUsageUseCase {
  constructor(
    private readonly ingest: IngestUsageUseCase,
    private readonly ledger: UsageLedger,
    private readonly declared: DeclaredBindings,
    private readonly identity: PersonIdentityStore
  ) {}

  async execute(request: ReportRequest): Promise<ReportResult> {
    const ingested = await this.ingest.execute();
    if (ingested.refused) return { status: "refused" };
    const held = await this.ledger.exclusively(() => this.ledger.load());
    const records = held.records.filter((record) => inPeriod(record.at, request.period));
    const report = buildReport(
      records,
      await this.declared.read(),
      await this.identity.read(),
      request.axis
    );
    return {
      status: "reported",
      period: request.period,
      report,
      coverage: {
        filesRead: ingested.filesRead,
        records: records.length,
        unrecognised: ingested.unrecognised,
        notStored: ingested.notStored,
        oldestTranscriptAt: ingested.oldestTranscriptAt,
        skippedLedgerLines: held.skippedLines,
      },
    };
  }
}
