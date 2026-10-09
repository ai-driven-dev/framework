import type { UnattributedReason } from "../../domain/report/attribution.js";
import type { Period } from "../../domain/report/period.js";
import type { CounterSum, ReportAxis, ReportRow, Tally } from "../../domain/report/usage-report.js";
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

/** What `aidd telemetry report --json` prints. Version 1.
 *
 * `rows` split the period along `axis`; the rows of every axis add up to the same `totals`,
 * counter by counter. `unknown_records` is how many calls had at least one counter unknown.
 * `coverage` says what the figures rest on: `files_read` and `unrecognised_shapes` are of
 * this run alone, `records` of the period, `not_stored` counts calls this run read and left
 * out by reason, and `oldest_transcript_at` is when the oldest transcript still on disk was
 * last written (`null` when there is none). Nothing here is a path, a working directory or
 * a branch name.
 *
 * Under `AIDD_TELEMETRY=0` nothing is read and the envelope is `{ "version": 1, "refused":
 * "AIDD_TELEMETRY=0" }` (`REFUSED_ENVELOPE`).
 *
 * A new field may appear in a version 1 envelope; a field is never renamed, retyped or removed
 * without a new `version`. */
export interface ReportEnvelope {
  readonly version: 1;
  readonly period: Period;
  readonly axis: ReportAxis;
  readonly rows: readonly EnvelopeRow[];
  readonly totals: EnvelopeTally;
  readonly unknown_records: number;
  readonly coverage: {
    readonly files_read: number;
    readonly records: number;
    readonly unrecognised_shapes: number;
    readonly not_stored: Readonly<Record<NotStoredReason, number>>;
    readonly oldest_transcript_at: string | null;
    readonly skipped_ledger_lines: number;
  };
}

function counterOf(sum: CounterSum): EnvelopeCounter {
  return { tokens: sum.known, unknown_records: sum.unknownRecords };
}

function tallyOf(tally: Tally): EnvelopeTally {
  return {
    records: tally.records,
    input: counterOf(tally.counters.input),
    output: counterOf(tally.counters.output),
    cache_read: counterOf(tally.counters.cache_read),
    cache_write: counterOf(tally.counters.cache_write),
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
  const { period, report, coverage } = result;
  return {
    version: 1,
    period,
    axis: report.axis,
    rows: report.rows.map(rowOf),
    totals: tallyOf(report.totals),
    unknown_records: report.totals.total.unknownRecords,
    coverage: {
      files_read: coverage.filesRead,
      records: coverage.records,
      unrecognised_shapes: coverage.unrecognised,
      not_stored: coverage.notStored,
      oldest_transcript_at: coverage.oldestTranscriptAt,
      skipped_ledger_lines: coverage.skippedLedgerLines,
    },
  };
}

/** What `--json` prints under `AIDD_TELEMETRY=0`, when nothing was read. */
export const REFUSED_ENVELOPE = { version: 1, refused: "AIDD_TELEMETRY=0" } as const;
