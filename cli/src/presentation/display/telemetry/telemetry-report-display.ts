import type {
  ReportCoverage,
  ReportRun,
  ReportUsageResult,
} from "../../../contexts/telemetry/application/report/report-usage.js";
import type { RequestReportResult } from "../../../contexts/telemetry/application/report/request-report.js";
import type { Period } from "../../../contexts/telemetry/contract/period.js";
import type { Selector } from "../../../contexts/telemetry/contract/report-filter.js";
import type { ReportAxis } from "../../../contexts/telemetry/contract/usage-report.js";
import type { Output } from "../../../orchestration/domain/output.js";
import { count, leftOutLines } from "./telemetry-read-display.js";
import { labelOf, table } from "./telemetry-report-table-display.js";

/** Each filter given, as the row it selects is labelled; `null` when none is. */
function selectionLine(selected: readonly (readonly [ReportAxis, Selector])[]): string | null {
  const parts = selected.map(
    ([axis, selector]) =>
      `${axis} = ${selector.kind === "unattributed-any" ? "unattributed, either reason" : labelOf(axis, selector)}`
  );
  return parts.length === 0 ? null : `Selected: ${parts.join(", ")}`;
}

/** Two flags given that select on one axis, as they were typed. */
function conflictWords(result: Extract<ReportUsageResult, { status: "conflicting" }>): string {
  const [first, second] = result.flags.map((flag) =>
    flag === "absent" ? `--absent ${result.absent}` : `--${flag}`
  );
  return `${first} and ${second} select on the same axis, so together they keep nothing: give one of them.`;
}

function periodWords(period: Period): string {
  if (period.from !== null && period.to !== null) return `${period.from} to ${period.to}`;
  if (period.from !== null) return `since ${period.from}`;
  return period.to === null ? "all days" : `until ${period.to}`;
}

function coverageLines(coverage: ReportCoverage, run: ReportRun): string[] {
  const { undated, unrecognised, requestless } = coverage.leftOut;
  return [
    `Read ${count(run.filesRead, "transcript", "transcripts")} just now; ${count(coverage.records, "call", "calls")} in this period; oldest transcript on disk: ${run.oldestTranscriptAt?.slice(0, 10) ?? "none"}.`,
    ...leftOutLines(run).map(({ text }) => text),
    ...(unrecognised > 0
      ? [
          `Kept from every read: ${count(unrecognised, "line that is", "lines that are")} no usage line.`,
        ]
      : []),
    ...(undated > 0
      ? [`Kept from every read: ${count(undated, "call", "calls")} with no usable time.`]
      : []),
    ...(requestless > 0
      ? [`Kept from every read: ${count(requestless, "call", "calls")} with no request id.`]
      : []),
  ];
}

type Reported = Extract<RequestReportResult, { status: "reported" }>;

function printNotReported(output: Output, result: Exclude<RequestReportResult, Reported>): void {
  if (result.status === "refused") {
    output.info("AIDD_TELEMETRY=0: nothing was read and nothing is reported.");
  } else if (result.status === "conflicting") {
    output.error(conflictWords(result));
  } else if (result.status === "not-a-repository") {
    output.error(
      "--repository . names the repository this directory is in, and it is in none: not a git repository, unreadable, or with neither an origin nor a commit."
    );
  } else {
    const { flag, typed, ids } = result;
    const many = flag === "session" ? "sessions" : "repositories";
    output.error(
      `--${flag} ${typed} starts ${ids.length} ${many} of this period: ${ids.join(", ")}. Type more of it.`
    );
  }
}

function printReportBody(output: Output, { report, selected }: Reported): void {
  const selection = selectionLine(selected);
  if (selection !== null) output.print(selection);
  if (report.totals.records === 0) {
    output.print(
      selection === null
        ? "No calls in this period."
        : "No call in this period matches these filters."
    );
    return;
  }
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

export function printUsageReport(output: Output, result: RequestReportResult): void {
  if (result.status !== "reported") {
    printNotReported(output, result);
    return;
  }
  const { report, coverage, run, period } = result;
  output.print(`Usage, ${periodWords(period)}, by ${report.axis}`);
  printReportBody(output, result);
  output.print("");
  for (const line of coverageLines(coverage, run)) output.print(line);
}
