import type { StoredUsage } from "../stored-usage.js";
import { compareText } from "../text-order.js";
import {
  type Attribution,
  type AttributionFacts,
  attribute,
  UNATTRIBUTED_REASONS,
  type UnattributedReason,
} from "./attribution.js";

export const REPORT_AXES = [
  "total",
  "person",
  "session",
  "model",
  "day",
  "repository",
  "task",
  "ticket",
] as const;
export type ReportAxis = (typeof REPORT_AXES)[number];

export const COUNTERS = ["input", "output", "cache_read", "cache_write"] as const;
export type Counter = (typeof COUNTERS)[number];

export interface CounterSum {
  readonly known: number;
  readonly unknownRecords: number;
}

export type AxisValue =
  | { readonly kind: "value"; readonly value: string }
  | { readonly kind: "unattributed"; readonly reason: UnattributedReason }
  | { readonly kind: "absent" };

export interface Tally {
  readonly records: number;
  readonly counters: Readonly<Record<Counter, CounterSum>>;
  readonly total: CounterSum;
}

export interface ReportRow extends Tally {
  readonly value: AxisValue;
}

export interface UsageReport {
  readonly axis: ReportAxis;
  readonly rows: readonly ReportRow[];
  readonly totals: Tally;
}

const ABSENT: AxisValue = { kind: "absent" };

/** A counter nothing reported is left out of its sum and counted: it is never read as zero. */
function addCounter(sum: CounterSum, value: number | null): CounterSum {
  return value === null
    ? { known: sum.known, unknownRecords: sum.unknownRecords + 1 }
    : { known: sum.known + value, unknownRecords: sum.unknownRecords };
}

const EMPTY_SUM: CounterSum = { known: 0, unknownRecords: 0 };
const EMPTY_TALLY: Tally = {
  records: 0,
  counters: { input: EMPTY_SUM, output: EMPTY_SUM, cache_read: EMPTY_SUM, cache_write: EMPTY_SUM },
  total: EMPTY_SUM,
};

function tally(held: Tally, record: StoredUsage): Tally {
  const counters = {
    input: addCounter(held.counters.input, record.input),
    output: addCounter(held.counters.output, record.output),
    cache_read: addCounter(held.counters.cache_read, record.cache_read),
    cache_write: addCounter(held.counters.cache_write, record.cache_write),
  };
  const known = COUNTERS.reduce((sum, counter) => sum + (record[counter] ?? 0), 0);
  const unknown = COUNTERS.some((counter) => record[counter] === null);
  return {
    records: held.records + 1,
    counters,
    total: {
      known: held.total.known + known,
      unknownRecords: held.total.unknownRecords + (unknown ? 1 : 0),
    },
  };
}

function unattributedValue(
  attribution: Extract<Attribution, { state: "unattributed" }>
): AxisValue {
  return { kind: "unattributed", reason: attribution.reason };
}

function axisValueOf(
  axis: ReportAxis,
  record: StoredUsage,
  attribution: Attribution,
  person: string | null
): AxisValue {
  const value = (text: string | null): AxisValue =>
    text === null ? ABSENT : { kind: "value", value: text };
  switch (axis) {
    case "total":
      return value("total");
    case "person":
      return value(person);
    case "session":
      return value(record.session_id);
    case "model":
      return value(record.model);
    case "day":
      return value(new Date(record.at).toISOString().slice(0, 10));
    case "repository":
      return value(record.repository_id);
    case "task":
      return attribution.state === "attributed"
        ? value(attribution.task)
        : unattributedValue(attribution);
    case "ticket":
      return attribution.state === "attributed"
        ? value(attribution.ticket)
        : unattributedValue(attribution);
  }
}

/** Where a row stands among the others: values first, then calls the axis has no value for,
 * then work with no task, by reason. */
function rank(value: AxisValue): number {
  if (value.kind === "value") return 0;
  return value.kind === "absent" ? 1 : 2 + UNATTRIBUTED_REASONS.indexOf(value.reason);
}

function textOf(value: AxisValue): string {
  return value.kind === "value" ? value.value : "";
}

/** Only value rows tie on rank. Days read in order; every other axis reads largest first. */
function compareRows(axis: ReportAxis, a: ReportRow, b: ReportRow): number {
  const byRank = rank(a.value) - rank(b.value);
  if (byRank !== 0) return byRank;
  const byText = compareText(textOf(a.value), textOf(b.value));
  return axis === "day" ? byText : b.total.known - a.total.known || byText;
}

/** What the calls cost, split along one axis. Every axis is a partition of the same calls, so
 * every axis adds up to the same totals: a call lands on exactly one row. */
export function buildReport(
  records: readonly StoredUsage[],
  facts: AttributionFacts,
  person: string | null,
  axis: ReportAxis
): UsageReport {
  const rows = new Map<string, ReportRow>();
  let totals = EMPTY_TALLY;
  for (const record of records) {
    const value = axisValueOf(axis, record, attribute(record, facts), person);
    const key = JSON.stringify(value);
    rows.set(key, { value, ...tally(rows.get(key) ?? EMPTY_TALLY, record) });
    totals = tally(totals, record);
  }
  return { axis, rows: [...rows.values()].sort((a, b) => compareRows(axis, a, b)), totals };
}
