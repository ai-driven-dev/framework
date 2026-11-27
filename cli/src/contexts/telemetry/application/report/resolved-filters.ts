import type { ReportFilters } from "../../contract/report-filter.js";
import { resolveId } from "../../domain/report/report-filter.js";
import type { StoredUsage } from "../../domain/stored-usage.js";

/** The flags typed as the start of an id. */
type PrefixFlag = "session" | "repository";

/** A start two ids or more of the period share, all of them, sorted. */
export interface AmbiguousStart {
  readonly status: "ambiguous";
  readonly flag: PrefixFlag;
  readonly typed: string;
  readonly ids: readonly string[];
}

/** A session or repository typed in full or by its start, among the ids of the period's calls.
 * A start that names none is kept as typed, and keeps no call. */
function resolvedIn(
  records: readonly StoredUsage[],
  flag: PrefixFlag,
  typed: string | null
): { readonly id: string | null } | AmbiguousStart {
  // A limit: no id observed starts with `null`, which a prefix of `null` would be read as.
  if (typed === null) return { id: null };
  const found = resolveId(
    typed,
    records.map((record) => (flag === "session" ? record.session_id : record.repository_id))
  );
  if (found.kind === "ambiguous") return { status: "ambiguous", flag, typed, ids: found.ids };
  return { id: found.kind === "found" ? found.id : typed };
}

/** The filters of the report: a session or repository typed as a start is resolved among the
 * ids of the period's calls. `.` names one repository in full: it is never the start of
 * another. */
export function resolvedFilters(
  records: readonly StoredUsage[],
  asked: ReportFilters,
  located: string | undefined
): ReportFilters | AmbiguousStart {
  const session = resolvedIn(records, "session", asked.session);
  if ("status" in session) return session;
  const repository =
    located === undefined ? resolvedIn(records, "repository", asked.repository) : { id: located };
  if ("status" in repository) return repository;
  return { ...asked, session: session.id, repository: repository.id };
}
