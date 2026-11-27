import {
  type AxisValue,
  byCounter,
  COUNTERS,
  type CounterSum,
  type ReportAxis,
  type ReportRow,
  type Tally,
  UNATTRIBUTED_REASONS,
  type UnattributedReason,
  type UsageReport,
} from "../../contract/usage-report.js";
import type { StoredUsage } from "../stored-usage.js";
import { compareText } from "../text-order.js";
import { type Attribution, type AttributionFacts, attribute } from "./attribution.js";
import { dayOf } from "./period.js";

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
  counters: byCounter(() => EMPTY_SUM),
  total: EMPTY_SUM,
};

function tally(held: Tally, record: StoredUsage): Tally {
  const counters = byCounter((counter) => addCounter(held.counters[counter], record[counter]));
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

function unattributedValue(reason: UnattributedReason): AxisValue {
  return { kind: "unattributed", reason };
}

/** What a call is on one axis: the row it lands on, and what a filter on that axis compares. */
export function axisValueOf({
  axis,
  record,
  attribution,
  person,
}: {
  readonly axis: ReportAxis;
  readonly record: StoredUsage;
  readonly attribution: Attribution;
  readonly person: string | null;
}): AxisValue {
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
    case "agent":
      return value(record.agent);
    case "tool":
      return value(record.tool);
    case "day":
      return value(dayOf(record.at));
    case "repository":
      return value(record.repository_id);
    case "task":
      return attribution.state === "attributed"
        ? value(attribution.task)
        : unattributedValue(attribution.reason);
    case "ticket":
      return attribution.state === "attributed"
        ? value(attribution.ticket)
        : unattributedValue(attribution.reason);
  }
}

/** The row a value lands on: one per value, and what a filter is compared through. */
export function rowKeyOf(value: AxisValue): string {
  return JSON.stringify(value);
}

type ValueRow = ReportRow & { readonly value: Extract<AxisValue, { kind: "value" }> };
type OtherRow = ReportRow & { readonly value: Exclude<AxisValue, { kind: "value" }> };

const isValueRow = (row: ReportRow): row is ValueRow => row.value.kind === "value";
const isOtherRow = (row: ReportRow): row is OtherRow => row.value.kind !== "value";

/** Calls the axis has no value for, then work with no task, by reason. */
const OTHER_ORDER = [ABSENT, ...UNATTRIBUTED_REASONS.map(unattributedValue)].map(rowKeyOf);

function rank({ value }: OtherRow): number {
  return OTHER_ORDER.indexOf(rowKeyOf(value));
}

/** Days read in order; every other axis reads largest first. */
function compareValueRows(axis: ReportAxis, a: ValueRow, b: ValueRow): number {
  const byText = compareText(a.value.value, b.value.value);
  return axis === "day" ? byText : b.total.known - a.total.known || byText;
}

function ordered(axis: ReportAxis, rows: readonly ReportRow[]): ReportRow[] {
  return [
    ...rows.filter(isValueRow).sort((a, b) => compareValueRows(axis, a, b)),
    ...rows.filter(isOtherRow).sort((a, b) => rank(a) - rank(b)),
  ];
}

/** What the calls cost, split along one axis. Every axis is a partition of the same calls, so
 * every axis adds up to the same totals: a call lands on exactly one row. */
export function buildReport({
  records,
  facts,
  person,
  axis,
}: {
  readonly records: readonly StoredUsage[];
  readonly facts: AttributionFacts;
  readonly person: string | null;
  readonly axis: ReportAxis;
}): UsageReport {
  const rows = new Map<string, ReportRow>();
  let totals = EMPTY_TALLY;
  for (const record of records) {
    const value = axisValueOf({ axis, record, attribution: attribute(record, facts), person });
    const key = rowKeyOf(value);
    rows.set(key, { value, ...tally(rows.get(key) ?? EMPTY_TALLY, record) });
    totals = tally(totals, record);
  }
  return { axis, rows: ordered(axis, [...rows.values()]), totals };
}
