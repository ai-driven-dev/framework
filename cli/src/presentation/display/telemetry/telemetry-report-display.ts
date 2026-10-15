import type {
  ReportCoverage,
  ReportResult,
} from "../../../contexts/telemetry/application/report/report-usage-use-case.js";
import type { Period } from "../../../contexts/telemetry/domain/report/period.js";
import {
  type ReportFilters,
  selectorsOf,
} from "../../../contexts/telemetry/domain/report/report-filter.js";
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
import {
  DAMAGED_CONSENT_LOG_WORDS,
  NOT_STORED_WORDS,
  UNRECOGNISED_WORDS,
} from "../telemetry-display.js";

const SHORT = 8;
const COLUMNS = ["Input", "Output", "Cache read", "Cache write", "Total"] as const;

const ABSENT: Readonly<Record<ReportAxis, string>> = {
  total: "all",
  person: "not set",
  session: "no session",
  model: "unknown model",
  agent: "no agent",
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

/** Each filter given, as the row it selects is labelled; `null` when none is. */
function selectionLine(filters: ReportFilters): string | null {
  const parts = selectorsOf(filters).map(
    ([axis, selector]) =>
      `${axis} = ${selector.kind === "unattributed-any" ? "unattributed, either reason" : labelOf(axis, selector)}`
  );
  return parts.length === 0 ? null : `Selected: ${parts.join(", ")}`;
}

/** Two flags given that select on one axis, as they were typed. */
function conflictWords(result: Extract<ReportResult, { status: "conflicting" }>): string {
  const [first, second] = result.flags.map((flag) =>
    flag === "absent" ? `--absent ${result.absent}` : `--${flag}`
  );
  return `${first} and ${second} select on the same axis, so together they keep nothing: give one of them.`;
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
  if (coverage.consentLogDamaged) lines.push(DAMAGED_CONSENT_LOG_WORDS);
  if (coverage.skippedLedgerLines > 0) {
    const n = coverage.skippedLedgerLines;
    lines.push(
      `${count(n, "ledger line", "ledger lines")} ${n === 1 ? "was" : "were"} not a record and dropped.`
    );
  }
  return lines;
}

export function printUsageReport(output: CLIOutput, result: ReportResult): void {
  if (result.status === "refused") {
    output.info("AIDD_TELEMETRY=0: nothing was read and nothing is reported.");
    return;
  }
  if (result.status === "conflicting") {
    output.error(conflictWords(result));
    return;
  }
  if (result.status === "not-a-repository") {
    output.error(
      "--repository . names the repository this directory is in, and it is in none: not a git repository, unreadable, or with neither an origin nor a commit."
    );
    return;
  }
  if (result.status === "ambiguous") {
    const { flag, typed, ids } = result;
    const many = flag === "session" ? "sessions" : "repositories";
    output.error(
      `--${flag} ${typed} starts ${ids.length} ${many} of this period: ${ids.join(", ")}. Type more of it.`
    );
    return;
  }
  const { report, coverage, period, filters } = result;
  output.print(`Usage, ${periodWords(period)}, by ${report.axis}`);
  const selection = selectionLine(filters);
  if (selection !== null) output.print(selection);
  if (report.totals.records === 0) {
    output.print(
      selection === null
        ? "No calls in this period."
        : "No call in this period matches these filters."
    );
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
