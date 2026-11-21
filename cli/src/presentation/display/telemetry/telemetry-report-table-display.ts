import {
  type AxisValue,
  COUNTERS,
  type CounterSum,
  type ReportAxis,
  type ReportRow,
  type Tally,
} from "../../../contexts/telemetry/contract/usage-report.js";
import { grouped } from "./telemetry-read-display.js";

const SHORT = 8;
const COLUMNS = ["Input", "Output", "Cache read", "Cache write", "Total"] as const;

const ABSENT: Readonly<Record<ReportAxis, string>> = {
  total: "all",
  person: "anonymous",
  session: "no session",
  model: "unknown model",
  agent: "no agent",
  day: "no day",
  repository: "no repository",
  task: "no task",
  ticket: "no ticket",
  tool: "no tool",
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

export function labelOf(axis: ReportAxis, value: AxisValue): string {
  if (value.kind === "absent") return ABSENT[axis];
  if (value.kind === "unattributed") return UNATTRIBUTED[value.reason];
  const shown =
    axis === "session" || axis === "repository" ? value.value.slice(0, SHORT) : value.value;
  return oneLine(shown);
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

export function table(axis: ReportAxis, rows: readonly ReportRow[], totals: Tally): string[] {
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
