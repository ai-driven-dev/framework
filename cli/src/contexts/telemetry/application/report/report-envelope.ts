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

/** What `aidd telemetry report --json` prints. Version 2.
 *
 * Every field but `run` is a figure: a function of the ledger (its calls and what was left out
 * of it), the declarations, the chosen identity, the period, the filters and the axis, alone.
 * Two reports over the same of those print them byte for byte the same, whatever ingest ran
 * before, in any time zone and locale. `run`, last, is what the read that printed the envelope
 * found, and may differ between two such reports.
 *
 * `rows` split the period along `axis`; the rows of every axis add up to the same `totals`,
 * counter by counter. `unknown_records` is how many calls had at least one counter unknown.
 * `coverage.records` counts every call of the period, matching the filters or not, and
 * `coverage.left_out` what every ingest so far, whoever ran it (the plugin's included),
 * measured and could not store, of a clone that consents: `undated` calls and `unrecognised`
 * lines that are no usage line, each once; none has a day, so every report counts all of them.
 *
 * `run`: `files_read` transcripts this read opened, `unrecognised_shapes` and `not_stored` (by
 * reason) what it met and did not store, `consent_log_damaged` true while
 * `ledger/consents.jsonl` cannot be trusted and nothing is stored, `oldest_transcript_at` when
 * the oldest transcript still on disk was last written (`null` when there is none), and
 * `skipped_ledger_lines` the lines that were not records, kept as found, in the ledger
 * partitions it read before settling them: a bounded report reads its period and the day on
 * each side. Nothing here is a path, a working directory or a branch name.
 *
 * `filters` names what the report was narrowed to, every flag in a fixed order, `null` when it
 * was not given, else as resolved: the full id for a start or `.`, the start as typed when it
 * names no call of the period. `rows` and `totals` count the calls that match.
 *
 * Under `AIDD_TELEMETRY=0` nothing is read and the envelope is `{ "version": 2, "refused":
 * "AIDD_TELEMETRY=0" }` (`REFUSED_ENVELOPE`).
 *
 * A new field may appear in a version 2 envelope, a figure outside `run`, a fact of the read in
 * it; a field is never renamed, retyped, moved or removed without a new `version`. */
export interface ReportEnvelope {
  readonly version: 2;
  readonly period: Period;
  readonly axis: ReportAxis;
  readonly filters: ReportFilters;
  readonly rows: readonly EnvelopeRow[];
  readonly totals: EnvelopeTally;
  readonly unknown_records: number;
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
    unknown_records: report.totals.total.unknownRecords,
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
