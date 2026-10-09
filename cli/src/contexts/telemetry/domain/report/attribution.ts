import { type BranchSnapshot, snapshotKey } from "../branch-binding.js";
import { resolveBinding } from "../declaration/binding-resolution.js";
import type { SessionCarry, SessionDeclaration } from "../declaration/task-declaration.js";

/** Why a billed call has no task. `outside-repo` and `root-unresolved` are decided before the
 * ledger: a call from outside any repository, or from a directory never seen alive, is not
 * stored, so it reaches a report only as a count of what was not stored. */
export const UNATTRIBUTED_REASONS = [
  "outside-repo",
  "root-unresolved",
  "no-binding",
  "declared-none",
] as const;
export type UnattributedReason = (typeof UNATTRIBUTED_REASONS)[number];

export type Attribution =
  | { readonly state: "attributed"; readonly task: string; readonly ticket: string | null }
  | { readonly state: "unattributed"; readonly reason: UnattributedReason };

/** What a person declared, wherever it was kept. Never narrowed to a period: a declaration
 * made before one still attributes the calls inside it. */
export interface AttributionFacts {
  readonly declarations: readonly SessionDeclaration[];
  readonly carries: readonly SessionCarry[];
  /** The latest snapshot of each branch, keyed by `snapshotKey`. */
  readonly branches: ReadonlyMap<string, BranchSnapshot>;
}

export interface AttributableUsage {
  readonly session_id: string;
  readonly at: string;
  readonly git_branch: string | null;
  readonly repository_id: string;
}

const NO_BINDING: Attribution = { state: "unattributed", reason: "no-binding" };
const DECLARED_NONE: Attribution = { state: "unattributed", reason: "declared-none" };

/** A declaration of no task names no task. */
function verdict(task: string | null, ticket: string | null): Attribution {
  return task === null ? DECLARED_NONE : { state: "attributed", task, ticket };
}

/** The instant to ask the session's binding at. A carried session is bound provisionally from
 * its start, and its first declaration replaces that for the whole session, so a call made
 * before the first declaration is asked as of that declaration. A session that was not
 * carried is bound from its declaration onward and no earlier. */
function instantFor(at: number, facts: AttributionFacts, sessionId: string): number {
  const carried = facts.carries.filter((carry) => carry.session_id === sessionId);
  if (carried.length === 0) return at;
  const declared = facts.declarations
    .filter((declaration) => declaration.session_id === sessionId)
    .map((declaration) => Date.parse(declaration.declared_at));
  const started = carried.map((carry) => Date.parse(carry.at));
  return Math.max(at, Math.min(...(declared.length > 0 ? declared : started)));
}

function sessionVerdict(record: AttributableUsage, at: number, facts: AttributionFacts) {
  const binding = resolveBinding({
    sessionId: record.session_id,
    at: new Date(instantFor(at, facts, record.session_id)),
    declarations: facts.declarations,
    carries: facts.carries,
    branch: null,
  });
  return binding.state === "bound" ? verdict(binding.task, binding.ticket) : null;
}

/** A branch binds every call made on it after it was created, not only those after it was
 * declared: declaring late moves earlier work onto the task. */
function branchVerdict(
  record: AttributableUsage,
  at: number,
  facts: AttributionFacts
): Attribution | null {
  if (record.git_branch === null) return null;
  const branch = facts.branches.get(snapshotKey(record.repository_id, record.git_branch));
  if (branch === undefined || (branch.task === null && !branch.none)) return null;
  if (branch.branch_created_at !== null && !(at > Date.parse(branch.branch_created_at))) {
    return null;
  }
  return verdict(branch.task, branch.ticket);
}

/** What one billed call belongs to, from what people declared and nothing else: the
 * session's declaration, else the session's carry, else the branch's declaration, else no
 * task. Sub-agent and advisor calls name their parent's session, so they follow it. */
export function attribute(record: AttributableUsage, facts: AttributionFacts): Attribution {
  const at = Date.parse(record.at);
  return sessionVerdict(record, at, facts) ?? branchVerdict(record, at, facts) ?? NO_BINDING;
}
