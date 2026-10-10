import type {
  ReportCoverage,
  ReportResult,
} from "../../../contexts/telemetry/application/report/report-usage-use-case.js";
import type { Period } from "../../../contexts/telemetry/domain/report/period.js";
import {
  type AxisValue,
  COUNTERS,
  type CounterSum,
  type ReportAxis,
  type ReportRow,
  type Tally,
} from "../../../contexts/telemetry/domain/report/usage-report.js";
import type { NotStoredReason } from "../../../contexts/telemetry/domain/repository-resolution.js";
import type { CLIOutput } from "../../output.js";
import { NOT_STORED_WORDS, UNRECOGNISED_WORDS } from "../telemetry-display.js";

const SHORT = 8;
const COLUMNS = ["Input", "Output", "Cache read", "Cache write", "Total"] as const;

const ABSENT: Readonly<Record<ReportAxis, string>> = {
  total: "all",
  person: "not set",
  session: "no session",
  model: "unknown model",
  day: "no day",
  repository: "no repository",
  task: "no task",
  ticket: "no ticket",
};

type Reason = Extract<AxisValue, { kind: "unattributed" }>["reason"];

const UNATTRIBUTED: Readonly<Record<Reason, string>> = {
  "no-binding": "unattributed: no task declared",
  "declared-none": "unattributed: declared no task",
};

/** One line, whatever a person typed into a task name. */
function oneLine(text: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what is replaced
  return text.replace(/[\u0000-\u001f\u007f\s]+/g, " ").trim();
}

function labelOf(axis: ReportAxis, value: AxisValue): string {
  if (value.kind === "absent") return ABSENT[axis];
  if (value.kind === "unattributed") return UNATTRIBUTED[value.reason];
  const shown =
    axis === "session" || axis === "repository" ? value.value.slice(0, SHORT) : value.value;
  return oneLine(shown);
}

function grouped(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** A sum that left calls out is marked `+?`; one with nothing known at all is `unknown`. */
function cell(sum: CounterSum, records: number): string {
  if (sum.unknownRecords === 0) return grouped(sum.known);
  return sum.unknownRecords >= records ? "unknown" : `${grouped(sum.known)}+?`;
}

/** The four counters added: partial when any call left one out, unknown only when no counter
 * of any call was reported. */
function totalCell(tally: Tally): string {
  if (COUNTERS.every((name) => tally.counters[name].unknownRecords >= tally.records)) {
    return "unknown";
  }
  return tally.total.unknownRecords === 0
    ? grouped(tally.total.known)
    : `${grouped(tally.total.known)}+?`;
}

function cellsOf(tally: Tally): string[] {
  return [...COUNTERS.map((name) => cell(tally.counters[name], tally.records)), totalCell(tally)];
}

function table(axis: ReportAxis, rows: readonly ReportRow[], totals: Tally): string[] {
  const body = [
    [titleOf(axis), ...COLUMNS],
    ...rows.map((row) => [labelOf(axis, row.value), ...cellsOf(row)]),
    // The total axis is one row that already is the total.
    ...(axis === "total" ? [] : [["Total", ...cellsOf(totals)]]),
  ];
  const widths =
    body[0]?.map((_, column) => Math.max(...body.map((line) => (line[column] ?? "").length))) ?? [];
  return body.map((line) =>
    line
      .map((text, column) =>
        column === 0 ? text.padEnd(widths[0] ?? 0) : text.padStart(widths[column] ?? 0)
      )
      .join("  ")
  );
}

function titleOf(axis: ReportAxis): string {
  return axis === "total" ? "Period" : axis[0]?.toUpperCase() + axis.slice(1);
}

function count(n: number, one: string, many: string): string {
  return `${grouped(n)} ${n === 1 ? one : many}`;
}

function periodWords(period: Period): string {
  if (period.from !== null && period.to !== null) return `${period.from} to ${period.to}`;
  if (period.from !== null) return `since ${period.from}`;
  return period.to === null ? "all days" : `until ${period.to}`;
}

function coverageLines(coverage: ReportCoverage): string[] {
  const lines = [
    `Read ${count(coverage.filesRead, "transcript", "transcripts")} just now; ${count(coverage.records, "call", "calls")} in this period; oldest transcript on disk: ${coverage.oldestTranscriptAt?.slice(0, 10) ?? "none"}.`,
  ];
  if (coverage.unrecognised > 0) {
    lines.push(`${count(coverage.unrecognised, "shape", "shapes")} ${UNRECOGNISED_WORDS}`);
  }
  for (const [reason, n] of Object.entries(coverage.notStored) as [NotStoredReason, number][]) {
    if (n > 0) lines.push(`Not stored: ${count(n, "call", "calls")} ${NOT_STORED_WORDS[reason]}.`);
  }
  if (coverage.skippedLedgerLines > 0) {
    lines.push(
      `${count(coverage.skippedLedgerLines, "ledger line", "ledger lines")} not a record and skipped.`
    );
  }
  return lines;
}

export function printUsageReport(output: CLIOutput, result: ReportResult): void {
  if (result.status === "refused") {
    output.info("AIDD_TELEMETRY=0: nothing was read and nothing is reported.");
    return;
  }
  const { report, coverage, period } = result;
  output.print(`Usage, ${periodWords(period)}, by ${report.axis}`);
  if (report.totals.records === 0) {
    output.print("No calls in this period.");
  } else {
    output.print("");
    for (const line of table(report.axis, report.rows, report.totals)) output.print(line);
    const unknown = report.totals.total.unknownRecords;
    if (unknown > 0) {
      output.print("");
      output.print(
        `${count(unknown, "call", "calls")} had an unknown counter: ${unknown === 1 ? "it is" : "they are"} left out of the sums marked +?, never counted as zero.`
      );
    }
  }
  output.print("");
  for (const line of coverageLines(coverage)) output.print(line);
}
