import { tryParseJson } from "../../../kernel/reading/json-file.js";
import { asPlainObject } from "../../../kernel/reading/plain-object.js";
import { compareText } from "./text-order.js";
import { foldUsage } from "./usage-fold.js";
import { USAGE_AGENTS, USAGE_TOOLS, type UsageRecord } from "./usage-record.js";

/** A usage record as the ledger keeps it: the call, and the repository it was made in. The
 * repository is resolved at ingest and kept, because the working directory it came from may
 * be gone by the time anyone reports. */
export interface StoredUsage extends UsageRecord {
  readonly repository_id: string;
}

const COUNTERS = [
  "input",
  "output",
  "cache_read",
  "cache_write",
  "cache_write_1h",
  "reasoning",
] as const;

/** `YYYY-MM` in UTC, so a ledger partition does not depend on the machine's time zone. */
export function monthOf(at: string): string | null {
  const instant = Date.parse(at);
  return Number.isNaN(instant) ? null : new Date(instant).toISOString().slice(0, 7);
}

/** `YYYY-MM-DD` in UTC, so a ledger partition does not depend on the machine's time zone. */
export function dayOf(at: string): string | null {
  const instant = Date.parse(at);
  return Number.isNaN(instant) ? null : new Date(instant).toISOString().slice(0, 10);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The days an ingest of these records reads: each record's day and the day on each side. A
 * call's snapshots are written minutes apart, so a neighbour day holds any earlier one. */
export function daysAround(records: readonly UsageRecord[]): ReadonlySet<string> {
  const days = new Set<string>();
  for (const record of records) {
    const day = dayOf(record.at);
    if (day === null) continue;
    const midnight = Date.parse(`${day}T00:00:00.000Z`);
    for (const instant of [midnight - DAY_MS, midnight, midnight + DAY_MS]) {
      days.add(new Date(instant).toISOString().slice(0, 10));
    }
  }
  return days;
}

function id(record: UsageRecord): string {
  return `${record.tool}\u0000${record.key}`;
}

export interface Upserted {
  /** Everything held after the upsert, one record per `(tool, key)`. */
  readonly records: readonly StoredUsage[];
  readonly added: number;
  readonly updated: number;
  /** The months whose partition no longer says what it did: where each added or replaced
   * record is now, and where a replaced one was. The rest are as they were. */
  readonly months: ReadonlySet<string>;
}

/** Folds incoming records into what is held, with the same fold that counts a call once. Held
 * records come first, so an incoming copy equal to one held changes nothing; a record that
 * beats the one held replaces it, repository included. */
export function upsertUsage(
  held: readonly StoredUsage[],
  incoming: readonly StoredUsage[]
): Upserted {
  const before = new Map(held.map((record) => [id(record), record]));
  const records = foldUsage([...held, ...incoming]);
  const months = new Set<string>();
  let added = 0;
  let updated = 0;
  for (const record of records) {
    const was = before.get(id(record));
    if (was !== undefined && was === record) continue;
    if (was === undefined) added += 1;
    else updated += 1;
    for (const moved of [record, was]) {
      const month = moved === undefined ? null : monthOf(moved.at);
      if (month !== null) months.add(month);
    }
  }
  return { records, added, updated, months };
}

/** Records grouped by the day of their own time, each day in time order then key, so the
 * bytes of a partition depend on what it holds and never on the order it was found in. A
 * record whose time does not parse has no day and is left out. Linear in the records, bar
 * the sort: each time is parsed once, and each day's array only ever grows by `push`. */
export function partitionByDay(
  records: readonly StoredUsage[]
): ReadonlyMap<string, readonly StoredUsage[]> {
  return partitionBy(records, dayOf);
}

export function partitionByMonth(
  records: readonly StoredUsage[]
): ReadonlyMap<string, readonly StoredUsage[]> {
  return partitionBy(records, monthOf);
}

function partitionBy(
  records: readonly StoredUsage[],
  partitionOf: (at: string) => string | null
): ReadonlyMap<string, readonly StoredUsage[]> {
  const dated: { readonly record: StoredUsage; readonly instant: number; readonly id: string }[] =
    [];
  for (const record of records) {
    if (partitionOf(record.at) !== null) {
      dated.push({ record, instant: Date.parse(record.at), id: id(record) });
    }
  }
  dated.sort((a, b) => a.instant - b.instant || compareText(a.id, b.id));
  const partitions = new Map<string, StoredUsage[]>();
  for (const { record } of dated) {
    const partition = partitionOf(record.at) as string;
    const held = partitions.get(partition);
    if (held === undefined) partitions.set(partition, [record]);
    else held.push(record);
  }
  return new Map([...partitions.entries()].sort(([a], [b]) => compareText(a, b)));
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

function isCounter(value: unknown): boolean {
  return value === null || (typeof value === "number" && Number.isInteger(value) && value >= 0);
}

function isNullableText(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function isStoredUsage(
  object: Record<string, unknown>
): object is Record<string, unknown> & StoredUsage {
  return (
    (USAGE_TOOLS as readonly unknown[]).includes(object.tool) &&
    (USAGE_AGENTS as readonly unknown[]).includes(object.agent) &&
    isText(object.key) &&
    isText(object.session_id) &&
    isText(object.at) &&
    isText(object.repository_id) &&
    isNullableText(object.tool_version) &&
    isNullableText(object.model) &&
    isNullableText(object.cwd) &&
    isNullableText(object.git_branch) &&
    COUNTERS.every((field) => isCounter(object[field]))
  );
}

/** A ledger line read back, or `null` when it is not one. */
export function parseStoredUsage(line: string): StoredUsage | null {
  const parsed = tryParseJson(line);
  const object = parsed.ok ? asPlainObject(parsed.value) : null;
  return object !== null && isStoredUsage(object) ? object : null;
}
