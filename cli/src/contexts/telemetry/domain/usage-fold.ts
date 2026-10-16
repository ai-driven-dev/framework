import { compareText } from "./text-order.js";
import { type UsageRecord, usageTotal } from "./usage-record.js";

function instant(at: string): number {
  return Date.parse(at);
}

/** Earlier is smaller; a time that does not parse falls back to its text. */
function compareAt(a: string, b: string): number {
  const x = instant(a);
  const y = instant(b);
  if (Number.isNaN(x) || Number.isNaN(y)) return compareText(a, b);
  return x - y;
}

/** Negative when `a` is the one to keep: the largest total, then the earliest time, then the
 * lowest session id, then the serialised record, so no input order can change the winner. */
function compareWinner(a: UsageRecord, b: UsageRecord): number {
  return (
    usageTotal(b) - usageTotal(a) ||
    compareAt(a.at, b.at) ||
    compareText(a.session_id, b.session_id) ||
    compareText(JSON.stringify(a), JSON.stringify(b))
  );
}

/** One record per `(tool, key)` across everything given: a streamed call and a resumed copy
 * show the same call several times, and only one of them is the call. */
export function foldUsage<T extends UsageRecord>(records: Iterable<T>): T[] {
  const winners = new Map<string, T>();
  for (const record of records) {
    const id = `${record.tool}\u0000${record.key}`;
    const held = winners.get(id);
    if (held === undefined || compareWinner(record, held) < 0) winners.set(id, record);
  }
  return [...winners.entries()].sort(([a], [b]) => compareText(a, b)).map(([, record]) => record);
}
