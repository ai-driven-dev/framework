import { describe, expect, it } from "vitest";
import type { BranchConfigBinding } from "../../../../src/contexts/telemetry/domain/branch-binding.js";
import { resolveBinding } from "../../../../src/contexts/telemetry/domain/declaration/binding-resolution.js";
import type {
  SessionCarry,
  SessionDeclaration,
} from "../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";

const declaration = (
  session_id: string,
  task: string | null,
  declared_at: string,
  none = false
): SessionDeclaration => ({ session_id, task, ticket: null, none, declared_at, by: "command" });
const carry = (session_id: string, from: string, at: string): SessionCarry => ({
  session_id,
  from,
  at,
});
const branch = (task: string | null, none = false): BranchConfigBinding => ({
  branch: "feat/x",
  task,
  ticket: null,
  declared_at: task === null && !none ? null : "2026-10-09T09:00:00.000Z",
  none,
});
const at = (iso: string) => new Date(`2026-10-09T${iso}.000Z`);

describe("which declaration of a session holds at an instant", () => {
  const declarations = [
    declaration("s", "first", "2026-10-09T10:00:00.000Z"),
    declaration("s", "second", "2026-10-09T12:00:00.000Z"),
  ];
  const resolve = (when: string) =>
    resolveBinding({ sessionId: "s", at: at(when), declarations, carries: [], branch: null });

  it("is the latest made by then: earlier work keeps the earlier task", () => {
    expect(resolve("11:00:00")).toMatchObject({ source: "session-declared", task: "first" });
    expect(resolve("13:00:00")).toMatchObject({ source: "session-declared", task: "second" });
  });

  it("counts a declaration from its own instant", () => {
    expect(resolve("12:00:00")).toMatchObject({ task: "second" });
  });

  it("does not count one made after the instant", () => {
    expect(resolve("09:00:00")).toEqual({ state: "unbound" });
  });

  it("is order-independent for declarations at different times", () => {
    const reversed = [...declarations].reverse();
    expect(
      resolveBinding({
        sessionId: "s",
        at: at("13:00:00"),
        declarations: reversed,
        carries: [],
        branch: null,
      })
    ).toMatchObject({ task: "second" });
  });
});

describe("a session declared none", () => {
  it("is bound to no task, and the branch's task does not show through", () => {
    expect(
      resolveBinding({
        sessionId: "s",
        at: at("11:00:00"),
        declarations: [declaration("s", null, "2026-10-09T10:00:00.000Z", true)],
        carries: [],
        branch: branch("branch-task"),
      })
    ).toMatchObject({ state: "bound", source: "session-declared", task: null, none: true });
  });
});

describe("a carried binding", () => {
  const declarations = [
    declaration("a", "from-a", "2026-10-09T10:00:00.000Z"),
    declaration("a", "re-declared-in-a", "2026-10-09T16:00:00.000Z"),
  ];
  const carries = [carry("b", "a", "2026-10-09T14:00:00.000Z")];

  it("is the carried session's binding as it stood at the carry", () => {
    expect(
      resolveBinding({ sessionId: "b", at: at("17:00:00"), declarations, carries, branch: null })
    ).toMatchObject({ source: "session-carried", task: "from-a", carriedFrom: "a" });
  });

  it("beats the branch, and is beaten by the session's own declaration", () => {
    expect(
      resolveBinding({
        sessionId: "b",
        at: at("15:00:00"),
        declarations,
        carries,
        branch: branch("on-branch"),
      })
    ).toMatchObject({ source: "session-carried", task: "from-a" });
    expect(
      resolveBinding({
        sessionId: "b",
        at: at("18:00:00"),
        declarations: [...declarations, declaration("b", "own", "2026-10-09T17:00:00.000Z")],
        carries,
        branch: branch("on-branch"),
      })
    ).toMatchObject({ source: "session-declared", task: "own" });
  });

  it("does not exist before the carry was made", () => {
    expect(
      resolveBinding({ sessionId: "b", at: at("13:00:00"), declarations, carries, branch: null })
    ).toEqual({ state: "unbound" });
  });

  it("takes the latest of several carries made by then", () => {
    const two = [
      carry("b", "c", "2026-10-09T13:00:00.000Z"),
      carry("b", "a", "2026-10-09T14:00:00.000Z"),
    ];
    expect(
      resolveBinding({
        sessionId: "b",
        at: at("15:00:00"),
        declarations: [...declarations, declaration("c", "from-c", "2026-10-09T09:00:00.000Z")],
        carries: two,
        branch: null,
      })
    ).toMatchObject({ task: "from-a" });
  });

  it("binds nothing when the carries form a cycle", () => {
    expect(
      resolveBinding({
        sessionId: "x",
        at: at("15:00:00"),
        declarations: [],
        carries: [
          carry("x", "y", "2026-10-09T14:00:00.000Z"),
          carry("y", "x", "2026-10-09T14:00:00.000Z"),
        ],
        branch: null,
      })
    ).toEqual({ state: "unbound" });
  });
});

describe("a branch", () => {
  const facts = (b: BranchConfigBinding | null, sessionId: string | null = null) => ({
    sessionId,
    at: at("15:00:00"),
    declarations: [],
    carries: [],
    branch: b,
  });

  it("is bound by a task, or by a declaration of none", () => {
    expect(resolveBinding(facts(branch("t")))).toMatchObject({
      state: "bound",
      source: "branch",
      task: "t",
    });
    expect(resolveBinding(facts(branch(null, true)))).toMatchObject({
      state: "bound",
      source: "branch",
      task: null,
      none: true,
    });
  });

  it("is unbound when it declares nothing, or when it is not a working branch", () => {
    expect(resolveBinding(facts(branch(null)))).toEqual({ state: "unbound" });
    expect(resolveBinding(facts(null))).toEqual({ state: "unbound" });
  });

  it("answers a session with no record at all", () => {
    expect(resolveBinding(facts(branch("t"), "never-seen"))).toMatchObject({ source: "branch" });
  });
});
