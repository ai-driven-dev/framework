import type { BranchConfigBinding } from "../branch-binding.js";
import type { SessionCarry, SessionDeclaration, TaskDeclaration } from "./task-declaration.js";

export type BindingSource = "session-declared" | "session-carried" | "branch";

/** What a piece of work is bound to, and where that comes from. */
export type Binding =
  | {
      readonly state: "bound";
      readonly source: BindingSource;
      readonly task: string | null;
      readonly ticket: string | null;
      /** Declared to have no task. */
      readonly none: boolean;
      /** The session a carried binding came from. */
      readonly carriedFrom?: string;
      readonly declaredAt: string | null;
    }
  | { readonly state: "unbound" };

export interface BindingFacts {
  readonly sessionId: string | null;
  /** The instant asked about: a declaration made after it does not count. */
  readonly at: Date;
  readonly declarations: readonly SessionDeclaration[];
  readonly carries: readonly SessionCarry[];
  /** The declaration of the branch being worked on, `null` when it is not a working branch. */
  readonly branch: BranchConfigBinding | null;
}

type SessionBinding = Extract<Binding, { state: "bound" }>;

/** The latest of the entries up to `at`, by their own time; of two at one instant, the one
 * written later. */
function latestUpTo<T>(entries: readonly T[], timeOf: (entry: T) => string, at: number): T | null {
  let latest: T | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const entry of entries) {
    const time = Date.parse(timeOf(entry));
    if (time <= at && time >= latestTime) {
      latest = entry;
      latestTime = time;
    }
  }
  return latest;
}

function declared(declaration: TaskDeclaration): SessionBinding {
  return {
    state: "bound",
    source: "session-declared",
    task: declaration.task,
    ticket: declaration.ticket,
    none: declaration.none,
    declaredAt: declaration.declared_at,
  };
}

/** A session's own binding at an instant: what it declared, else what it carried. A carry
 * takes the carried session's binding as it stood when the carry was made, whatever was
 * declared there since. */
function sessionBinding(
  facts: BindingFacts,
  sessionId: string,
  at: number,
  visiting: ReadonlySet<string>
): SessionBinding | null {
  if (visiting.has(sessionId)) return null;
  const own = latestUpTo(
    facts.declarations.filter((entry) => entry.session_id === sessionId),
    (entry) => entry.declared_at,
    at
  );
  if (own !== null) return declared(own);
  const carry = latestUpTo(
    facts.carries.filter((entry) => entry.session_id === sessionId),
    (entry) => entry.at,
    at
  );
  if (carry === null) return null;
  const from = sessionBinding(
    facts,
    carry.from,
    Date.parse(carry.at),
    new Set(visiting).add(sessionId)
  );
  return from === null ? null : { ...from, source: "session-carried", carriedFrom: carry.from };
}

/** Whether a piece of work is bound to a task: the session's own declaration, then the one
 * it carried across a `/clear`, then its branch's. */
export function resolveBinding(facts: BindingFacts): Binding {
  if (facts.sessionId !== null) {
    const session = sessionBinding(facts, facts.sessionId, facts.at.getTime(), new Set());
    if (session !== null) return session;
  }
  const branch = facts.branch;
  if (branch !== null && (branch.task !== null || branch.none)) {
    return {
      state: "bound",
      source: "branch",
      task: branch.task,
      ticket: branch.ticket,
      none: branch.none,
      declaredAt: branch.declared_at,
    };
  }
  return { state: "unbound" };
}
