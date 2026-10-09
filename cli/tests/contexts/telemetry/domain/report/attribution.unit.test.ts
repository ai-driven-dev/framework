import { describe, expect, it } from "vitest";
import {
  type BranchSnapshot,
  snapshotKey,
} from "../../../../../src/contexts/telemetry/domain/branch-binding.js";
import type {
  SessionCarry,
  SessionDeclaration,
} from "../../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import {
  type AttributableUsage,
  type AttributionFacts,
  attribute,
} from "../../../../../src/contexts/telemetry/domain/report/attribution.js";

const S1 = "session-1";
const S2 = "session-2";
const REPO = "repo-a";

const declaration = (
  session: string,
  at: string,
  task: string | null,
  ticket: string | null = null
): SessionDeclaration => ({
  session_id: session,
  task,
  ticket,
  none: task === null,
  declared_at: at,
  by: "command",
});
const carry = (session: string, from: string, at: string): SessionCarry => ({
  session_id: session,
  from,
  at,
});
const snapshot = (over: Partial<BranchSnapshot>): BranchSnapshot => ({
  repository_id: REPO,
  branch: "feat/x",
  task: "branch-task",
  ticket: null,
  declared_at: "2026-10-01T12:00:00.000Z",
  none: false,
  branch_created_at: "2026-10-01T08:00:00.000Z",
  snapshot_at: "2026-10-01T12:00:00.000Z",
  ...over,
});
/** Snapshots as the store keeps them: oldest first, by repository and branch name. */
const grouped = (snapshots: BranchSnapshot[]): AttributionFacts["branches"] => {
  const by = new Map<string, BranchSnapshot[]>();
  for (const s of snapshots) {
    const key = snapshotKey(s.repository_id, s.branch);
    by.set(key, [...(by.get(key) ?? []), s]);
  }
  return by;
};
const facts = (
  parts: {
    declarations?: SessionDeclaration[];
    carries?: SessionCarry[];
    branches?: BranchSnapshot[];
  } = {}
): AttributionFacts => ({
  declarations: parts.declarations ?? [],
  carries: parts.carries ?? [],
  branches: grouped(parts.branches ?? []),
});
const usage = (over: Partial<AttributableUsage> = {}): AttributableUsage => ({
  session_id: S1,
  at: "2026-10-02T10:00:00.000Z",
  git_branch: null,
  repository_id: REPO,
  ...over,
});
const task = (name: string, ticket: string | null = null) => ({
  state: "attributed",
  task: name,
  ticket,
});
const unattributed = (reason: string) => ({ state: "unattributed", reason });

describe("attribution: the session's own declaration", () => {
  it("applies from its own time, ticket included, and not before", () => {
    const f = facts({ declarations: [declaration(S1, "2026-10-02T10:00:00.000Z", "a", "T-1")] });
    expect(attribute(usage({ at: "2026-10-02T10:00:00.000Z" }), f)).toEqual(task("a", "T-1"));
    expect(attribute(usage({ at: "2026-10-02T09:59:59.999Z" }), f)).toEqual(
      unattributed("no-binding")
    );
  });

  it("is replaced from the time of a second declaration, the first keeping the work before it", () => {
    const f = facts({
      declarations: [
        declaration(S1, "2026-10-02T09:00:00.000Z", "first"),
        declaration(S1, "2026-10-02T11:00:00.000Z", "second"),
      ],
    });
    expect(attribute(usage({ at: "2026-10-02T10:59:59.000Z" }), f)).toEqual(task("first"));
    expect(attribute(usage({ at: "2026-10-02T11:00:00.000Z" }), f)).toEqual(task("second"));
    expect(attribute(usage({ at: "2026-10-02T12:00:00.000Z" }), f)).toEqual(task("second"));
  });

  it("beats the branch's declaration, whichever way each says", () => {
    const branches = [snapshot({})];
    const onBranch = usage({ git_branch: "feat/x" });
    expect(
      attribute(
        onBranch,
        facts({ branches, declarations: [declaration(S1, "2026-10-02T09:00:00.000Z", "mine")] })
      )
    ).toEqual(task("mine"));
    expect(
      attribute(
        onBranch,
        facts({ branches, declarations: [declaration(S1, "2026-10-02T09:00:00.000Z", null)] })
      )
    ).toEqual(unattributed("declared-none"));
  });

  it("does not leak into another session", () => {
    const f = facts({ declarations: [declaration(S2, "2026-10-02T09:00:00.000Z", "other")] });
    expect(attribute(usage(), f)).toEqual(unattributed("no-binding"));
  });
});

describe("attribution: a session that is not carried", () => {
  it("leaves the work before its first declaration to the branch", () => {
    const f = facts({
      declarations: [declaration(S1, "2026-10-02T11:00:00.000Z", "session-task")],
      branches: [snapshot({})],
    });
    const before = usage({ at: "2026-10-02T10:00:00.000Z", git_branch: "feat/x" });
    expect(attribute(before, f)).toEqual(task("branch-task"));
    const without = facts({
      declarations: [declaration(S1, "2026-10-02T11:00:00.000Z", "session-task")],
    });
    expect(attribute(before, without)).toEqual(unattributed("no-binding"));
  });
});

describe("attribution: a carried session", () => {
  const carried = [carry(S2, S1, "2026-10-02T12:00:00.000Z")];
  const origin = declaration(S1, "2026-10-02T09:00:00.000Z", "origin", "T-9");

  it("keeps the task of the session it replaced, for its whole life", () => {
    const f = facts({ declarations: [origin], carries: carried });
    expect(attribute(usage({ session_id: S2, at: "2026-10-02T13:00:00.000Z" }), f)).toEqual(
      task("origin", "T-9")
    );
  });

  it("keeps it for a call timed before the carry itself: a session cannot predate its start", () => {
    const f = facts({ declarations: [origin], carries: carried });
    expect(attribute(usage({ session_id: S2, at: "2026-10-02T11:00:00.000Z" }), f)).toEqual(
      task("origin", "T-9")
    );
  });

  it("takes the carried session's binding as it stood when the carry was made", () => {
    const f = facts({
      declarations: [origin, declaration(S1, "2026-10-02T14:00:00.000Z", "later")],
      carries: carried,
    });
    expect(attribute(usage({ session_id: S2, at: "2026-10-02T15:00:00.000Z" }), f)).toEqual(
      task("origin", "T-9")
    );
  });

  it("is moved whole by its first declaration, the work before it included", () => {
    const f = facts({
      declarations: [origin, declaration(S2, "2026-10-02T15:00:00.000Z", "corrected")],
      carries: carried,
    });
    expect(attribute(usage({ session_id: S2, at: "2026-10-02T12:30:00.000Z" }), f)).toEqual(
      task("corrected")
    );
    expect(attribute(usage({ session_id: S2, at: "2026-10-02T15:00:00.000Z" }), f)).toEqual(
      task("corrected")
    );
  });

  it("applies a later declaration from its own time only", () => {
    const f = facts({
      declarations: [
        origin,
        declaration(S2, "2026-10-02T15:00:00.000Z", "corrected"),
        declaration(S2, "2026-10-02T17:00:00.000Z", "again"),
      ],
      carries: carried,
    });
    const at = (time: string) => attribute(usage({ session_id: S2, at: time }), f);
    expect(at("2026-10-02T12:30:00.000Z")).toEqual(task("corrected"));
    expect(at("2026-10-02T16:59:00.000Z")).toEqual(task("corrected"));
    expect(at("2026-10-02T17:00:00.000Z")).toEqual(task("again"));
  });

  it("follows a chain of carries", () => {
    const f = facts({
      declarations: [origin],
      carries: [
        carry("s-mid", S1, "2026-10-02T10:00:00.000Z"),
        carry(S2, "s-mid", "2026-10-02T12:00:00.000Z"),
      ],
    });
    expect(attribute(usage({ session_id: S2, at: "2026-10-02T13:00:00.000Z" }), f)).toEqual(
      task("origin", "T-9")
    );
  });

  it("carries a declaration of no task as no task", () => {
    const f = facts({
      declarations: [declaration(S1, "2026-10-02T09:00:00.000Z", null)],
      carries: carried,
    });
    expect(attribute(usage({ session_id: S2, at: "2026-10-02T13:00:00.000Z" }), f)).toEqual(
      unattributed("declared-none")
    );
  });
});

describe("attribution: the branch's declaration", () => {
  const onBranch = (over: Partial<AttributableUsage> = {}) =>
    usage({ git_branch: "feat/x", ...over });

  it("attributes the records of the same repository and branch", () => {
    expect(attribute(onBranch(), facts({ branches: [snapshot({ ticket: "T-5" })] }))).toEqual(
      task("branch-task", "T-5")
    );
  });

  it("does not reach another repository's branch of the same name", () => {
    const f = facts({ branches: [snapshot({})] });
    expect(attribute(onBranch({ repository_id: "repo-b" }), f)).toEqual(unattributed("no-binding"));
  });

  it("does not reach another branch, nor a record that names none", () => {
    const f = facts({ branches: [snapshot({})] });
    expect(attribute(usage({ git_branch: "feat/y" }), f)).toEqual(unattributed("no-binding"));
    expect(attribute(usage({ git_branch: null }), f)).toEqual(unattributed("no-binding"));
  });

  it("leaves the work from before the branch existed", () => {
    const f = facts({ branches: [snapshot({ branch_created_at: "2026-10-02T10:00:00.000Z" })] });
    expect(attribute(onBranch({ at: "2026-10-02T09:59:59.000Z" }), f)).toEqual(
      unattributed("no-binding")
    );
    expect(attribute(onBranch({ at: "2026-10-02T10:00:01.000Z" }), f)).toEqual(task("branch-task"));
  });

  it("counts the instant of creation as before the branch", () => {
    const f = facts({ branches: [snapshot({ branch_created_at: "2026-10-02T10:00:00.000Z" })] });
    expect(attribute(onBranch({ at: "2026-10-02T10:00:00.000Z" }), f)).toEqual(
      unattributed("no-binding")
    );
  });

  it("never matches a record that names no branch to a branch called null", () => {
    const f = facts({ branches: [snapshot({ branch: "null" })] });
    expect(attribute(usage({ git_branch: null }), f)).toEqual(unattributed("no-binding"));
  });

  it("takes a branch whose creation was not captured as existing for every record", () => {
    const f = facts({ branches: [snapshot({ branch_created_at: null })] });
    expect(attribute(onBranch({ at: "2020-01-01T00:00:00.000Z" }), f)).toEqual(task("branch-task"));
  });

  it("moves work done before the branch was declared from no-binding to the task", () => {
    const work = onBranch({ at: "2026-10-01T10:00:00.000Z" });
    expect(attribute(work, facts())).toEqual(unattributed("no-binding"));
    const declared = facts({ branches: [snapshot({ declared_at: "2026-10-05T00:00:00.000Z" })] });
    expect(attribute(work, declared)).toEqual(task("branch-task"));
  });

  it("answers declared-none for a branch declared to have no task", () => {
    const f = facts({ branches: [snapshot({ task: null, none: true })] });
    expect(attribute(onBranch(), f)).toEqual(unattributed("declared-none"));
  });

  it("is no binding for a branch snapshot that declares nothing", () => {
    const f = facts({ branches: [snapshot({ task: null, none: false, declared_at: null })] });
    expect(attribute(onBranch(), f)).toEqual(unattributed("no-binding"));
  });
});

describe("attribution: a branch name used again", () => {
  const onBranch = (at: string) => usage({ git_branch: "feat/x", at });
  const first = snapshot({ task: "task-a", branch_created_at: "2026-10-01T08:00:00.000Z" });
  const second = snapshot({
    task: "task-b",
    declared_at: "2026-10-20T12:00:00.000Z",
    branch_created_at: "2026-10-15T08:00:00.000Z",
  });

  it("keeps the work of an earlier branch of that name on its own task", () => {
    const f = facts({ branches: [first, second] });
    expect(attribute(onBranch("2026-10-10T10:00:00.000Z"), f)).toEqual(task("task-a"));
    expect(attribute(onBranch("2026-10-16T10:00:00.000Z"), f)).toEqual(task("task-b"));
  });

  it("does not depend on the order the snapshots were taken in being the order of creation", () => {
    const f = facts({ branches: [second, first] });
    expect(attribute(onBranch("2026-10-10T10:00:00.000Z"), f)).toEqual(task("task-a"));
  });

  it("leaves work from before every branch of that name existed", () => {
    const f = facts({ branches: [first, second] });
    expect(attribute(onBranch("2026-09-30T10:00:00.000Z"), f)).toEqual(unattributed("no-binding"));
  });

  it("uses the latest snapshot within one generation, so declaring late still moves its work", () => {
    const redeclared = snapshot({
      task: "task-a2",
      declared_at: "2026-10-05T00:00:00.000Z",
      branch_created_at: "2026-10-01T08:00:00.000Z",
    });
    const f = facts({ branches: [first, redeclared, second] });
    expect(attribute(onBranch("2026-10-10T10:00:00.000Z"), f)).toEqual(task("task-a2"));
  });

  it("applies a snapshot with no creation time only when no dated generation matches", () => {
    const undated = snapshot({ task: "task-undated", branch_created_at: null });
    const f = facts({ branches: [undated, second] });
    expect(attribute(onBranch("2026-10-16T10:00:00.000Z"), f)).toEqual(task("task-b"));
    expect(attribute(onBranch("2026-10-10T10:00:00.000Z"), f)).toEqual(task("task-undated"));
  });
});

describe("attribution: a call made by a sub-agent or an advisor", () => {
  it("inherits its session's declaration, whatever branch it names", () => {
    const f = facts({
      declarations: [declaration(S1, "2026-10-02T09:00:00.000Z", "parent-task")],
      branches: [snapshot({ branch: "feat/other", task: "not-this" })],
    });
    const sub = usage({ git_branch: "feat/other" });
    expect(attribute(sub, f)).toEqual(task("parent-task"));
  });
});
