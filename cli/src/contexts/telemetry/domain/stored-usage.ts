import { tryParseJson } from "../../../kernel/reading/json-file.js";
import { asPlainObject } from "../../../kernel/reading/plain-object.js";
import { isRequestless } from "./formats/claude-transcript-usage.js";
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

/** A time that names its own zone and a four-digit year: anything else would be read in the
 * machine's zone, or give a day no partition name can hold. The closing anchor states the
 * whole shape; V8 already rejects any text after an ISO time, so no test can observe it. */
const ZONED = /^\d{4}-\d{2}-\d{2}T[^Z+-]*(Z|[+-]\d{2}:\d{2})$/;

/** `YYYY-MM-DD` in UTC, so a ledger partition does not depend on the machine's time zone, or
 * `null` for a time with no zone, or whose UTC day falls outside four-digit years. */
export function dayOf(at: string): string | null {
  if (!ZONED.test(at)) return null;
  const instant = Date.parse(at);
  if (Number.isNaN(instant)) return null;
  // An offset can carry the instant past year 9999 or before year 0, written `+YYYYYY`/`-YYYYYY`.
  const day = new Date(instant).toISOString().slice(0, 10);
  return day.startsWith("+") || day.startsWith("-") ? null : day;
}

const DAY_MS = 86_400_000;

/** The UTC day `days` after a `YYYY-MM-DD` day, as `toISOString` writes its first ten
 * characters: a day past four-digit years comes out in a shape no `YYYY-MM-DD` test accepts. */
export function shiftDay(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The days an ingest of these records reads: each record's day and the day on each side. A
 * call's snapshots are written minutes apart, so a neighbour day holds any earlier one. */
export function daysAround(records: readonly UsageRecord[]): ReadonlySet<string> {
  const days = new Set<string>();
  for (const record of records) {
    const day = dayOf(record.at);
    if (day === null) continue;
    for (const offset of [-1, 0, 1]) days.add(shiftDay(day, offset));
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
  /** The days whose partition no longer says what it did: where each added or replaced
   * record is now, and where a replaced one was. The rest are as they were. */
  readonly days: ReadonlySet<string>;
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
  const days = new Set<string>();
  let added = 0;
  let updated = 0;
  for (const record of records) {
    const was = before.get(id(record));
    if (was !== undefined && was === record) continue;
    if (was === undefined) added += 1;
    else updated += 1;
    for (const moved of [record, was]) {
      const day = moved === undefined ? null : dayOf(moved.at);
      if (day !== null) days.add(day);
    }
  }
  return { records, added, updated, days };
}

/** Records grouped by the day of their own time, each day in time order then key, so the
 * bytes of a partition depend on what it holds and never on the order it was found in. A
 * record with no day (see `dayOf`) is left out. Linear in the records, bar the sort: each
 * time is parsed once, and each day's array only ever grows by `push`. */
export function partitionByDay(
  records: readonly StoredUsage[]
): ReadonlyMap<string, readonly StoredUsage[]> {
  const dated: { readonly record: StoredUsage; readonly instant: number; readonly id: string }[] =
    [];
  for (const record of records) {
    if (dayOf(record.at) !== null) {
      dated.push({ record, instant: Date.parse(record.at), id: id(record) });
    }
  }
  dated.sort((a, b) => a.instant - b.instant || compareText(a.id, b.id));
  const days = new Map<string, StoredUsage[]>();
  for (const { record } of dated) {
    const day = dayOf(record.at) as string;
    const held = days.get(day);
    if (held === undefined) days.set(day, [record]);
    else held.push(record);
  }
  return new Map([...days.entries()].sort(([a], [b]) => compareText(a, b)));
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
    typeof object.at === "string" &&
    dayOf(object.at) !== null &&
    isText(object.repository_id) &&
    isNullableText(object.tool_version) &&
    isNullableText(object.model) &&
    isNullableText(object.cwd) &&
    isNullableText(object.git_branch) &&
    COUNTERS.every((field) => isCounter(object[field]))
  );
}

function readStoredUsage(line: string): StoredUsage | null {
  const parsed = tryParseJson(line);
  const object = parsed.ok ? asPlainObject(parsed.value) : null;
  return object !== null && isStoredUsage(object) ? object : null;
}

/** A ledger line read back, or `null` when it is not one this version accepts. A call with no
 * request id is not: one an older CLI writes after the migration is kept as found, as any line
 * that is not a record. */
export function parseStoredUsage(line: string): StoredUsage | null {
  const read = readStoredUsage(line);
  return read !== null && !isRequestless(read) ? read : null;
}

/** The call a ledger line holds when it has no request id, which the migration leaves out. */
export function requestlessIn(line: string): StoredUsage | null {
  const read = readStoredUsage(line);
  return read !== null && isRequestless(read) ? read : null;
}
