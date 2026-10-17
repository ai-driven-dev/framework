import type { LeftOutReason } from "../../domain/ports/usage-ledger.js";
import type { UnattributedReason } from "../../domain/report/attribution.js";
import type { Period } from "../../domain/report/period.js";
import { filtersOf, type ReportFilters } from "../../domain/report/report-filter.js";
import {
  COUNTERS,
  type Counter,
  type CounterSum,
  type ReportAxis,
  type ReportRow,
  type Tally,
} from "../../domain/report/usage-report.js";
import type { NotStoredReason } from "../../domain/repository-resolution.js";
import type { ReportResult } from "./report-usage-use-case.js";

/** A counter: the sum of the calls that reported it, and how many calls did not. A call that
 * did not report a counter is left out of the sum, never counted as zero. */
export interface EnvelopeCounter {
  readonly tokens: number;
  readonly unknown_records: number;
}

export interface EnvelopeTally {
  readonly records: number;
  readonly input: EnvelopeCounter;
  readonly output: EnvelopeCounter;
  readonly cache_read: EnvelopeCounter;
  readonly cache_write: EnvelopeCounter;
  /** The four counters added. `unknown_records` counts calls with any counter unknown. */
  readonly total: EnvelopeCounter;
}

export interface EnvelopeRow extends EnvelopeTally {
  /** `value`: a value of the axis, named by `key`. `unattributed`: work with no task, named
   * by `reason`. `absent`: calls the axis has no value for (no person chosen, no model, no
   * ticket). */
  readonly kind: "value" | "unattributed" | "absent";
  readonly key: string | null;
  readonly reason: UnattributedReason | null;
}

/** What `aidd telemetry report --json` prints, version 2: every field but `run` is a figure,
 * `run` is what the read that printed it found. What each field means, and what the figures
 * depend on, is defined once, in `plugins/aidd-telemetry/skills/01-usage/references/envelope.md`.
 * Under `AIDD_TELEMETRY=0` nothing is read: `REFUSED_ENVELOPE`. A field is never renamed,
 * retyped, moved or removed without a new `version`. */
export interface ReportEnvelope {
  readonly version: 2;
  readonly period: Period;
  readonly axis: ReportAxis;
  readonly filters: ReportFilters;
  readonly rows: readonly EnvelopeRow[];
  readonly totals: EnvelopeTally;
  readonly coverage: {
    readonly records: number;
    readonly left_out: Readonly<Record<LeftOutReason, number>>;
  };
  readonly run: {
    readonly files_read: number;
    readonly unrecognised_shapes: number;
    readonly not_stored: Readonly<Record<NotStoredReason, number>>;
    readonly consent_log_damaged: boolean;
    readonly oldest_transcript_at: string | null;
    readonly skipped_ledger_lines: number;
  };
}

function counterOf(sum: CounterSum): EnvelopeCounter {
  return { tokens: sum.known, unknown_records: sum.unknownRecords };
}

function tallyOf(tally: Tally): EnvelopeTally {
  const counters = COUNTERS.map((counter) => [counter, counterOf(tally.counters[counter])]);
  return {
    records: tally.records,
    ...(Object.fromEntries(counters) as Record<Counter, EnvelopeCounter>),
    total: counterOf(tally.total),
  };
}

function rowOf(row: ReportRow): EnvelopeRow {
  const { value } = row;
  return {
    kind: value.kind,
    key: value.kind === "value" ? value.value : null,
    reason: value.kind === "unattributed" ? value.reason : null,
    ...tallyOf(row),
  };
}

export function reportEnvelopeOf(
  result: Extract<ReportResult, { status: "reported" }>
): ReportEnvelope {
  const { period, filters, report, coverage, run } = result;
  return {
    version: 2,
    period,
    axis: report.axis,
    filters: filtersOf(filters),
    rows: report.rows.map(rowOf),
    totals: tallyOf(report.totals),
    coverage: { records: coverage.records, left_out: coverage.leftOut },
    run: {
      files_read: run.filesRead,
      unrecognised_shapes: run.unrecognised,
      not_stored: run.notStored,
      consent_log_damaged: run.consentLogDamaged,
      oldest_transcript_at: run.oldestTranscriptAt,
      skipped_ledger_lines: run.skippedLedgerLines,
    },
  };
}

/** What `--json` prints under `AIDD_TELEMETRY=0`, when nothing was read. */
export const REFUSED_ENVELOPE = { version: 2, refused: "AIDD_TELEMETRY=0" } as const;
