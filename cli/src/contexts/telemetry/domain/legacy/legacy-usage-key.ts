import { ADVISOR } from "../formats/claude-transcript-usage.js";
import type { StoredUsage } from "../stored-usage.js";
import type { UsageRecord } from "../usage-record.js";

/** A call's key as it is keyed now. An earlier version keyed a call with no request id
 * `message.id:sessionId:timestamp`, so each copy of it had its own key; the timestamp is the
 * call's own `at`, after its own session, and is dropped; only Claude Code was keyed so. Any
 * other key is kept: one keyed now
 * ends in its session, never in `:at`, so re-keying twice is re-keying once. */
export function currentKeyOf(
  call: Pick<UsageRecord, "tool" | "key" | "at" | "session_id">
): string {
  if (call.tool !== "claude-code") return call.key;
  const suffix = ADVISOR.exec(call.key)?.[0] ?? "";
  const base = call.key.slice(0, call.key.length - suffix.length);
  const earlier = `:${call.session_id}:${call.at}`;
  return base.endsWith(earlier) && base.length > earlier.length
    ? `${base.slice(0, -call.at.length - 1)}${suffix}`
    : call.key;
}

/** A stored call as it is keyed and named now: the same object when nothing changed, so a
 * reader can tell a partition that needs rewriting. */
export function storedNow<T extends StoredUsage>(record: T, ids: ReadonlyMap<string, string>): T {
  const key = currentKeyOf(record);
  const repositoryId = ids.get(record.repository_id) ?? record.repository_id;
  return key === record.key && repositoryId === record.repository_id
    ? record
    : { ...record, key, repository_id: repositoryId };
}
