import { describe, expect, it } from "vitest";
import { git } from "../helpers/git-sandbox.js";
import {
  addCall,
  aidd,
  declareBranch,
  json,
  rowsOf,
  S_BRANCH,
  sandbox,
  useReportSandbox,
} from "./telemetry-report-sandbox.js";

useReportSandbox();

/* In the sandbox, call 3 is the only call on feat/b whose session declared nothing, so the
 * branch alone decides it. Calls 1 and 2 are on feat/a, also decided by the branch. */
const gitHere = (...args: string[]) => git(sandbox.repo, sandbox.gitEnv, ...args);
/** git dated, so the reflog says when a branch was made or took its name. */
const gitAt = (iso: string, ...args: string[]) =>
  git(sandbox.repo, { ...sandbox.gitEnv, GIT_COMMITTER_DATE: iso, GIT_AUTHOR_DATE: iso }, ...args);
/** A call on feat/b by a session that declared nothing, so the branch alone decides it. */
const laterOnB = {
  id: "b2",
  session: S_BRANCH,
  at: "2026-10-08T12:00:00.000Z",
  branch: "feat/b",
  model: "m-big",
  input: 1,
  output: 1,
  read: 1,
  write: 1,
};

/** Declares feat/b `old-b`, and an older branch feat/source `source-task`, then comes back. */
async function declareOldBAndAnOlderSource(): Promise<void> {
  gitAt("2026-09-20T00:00:00Z", "branch", "feat/source");
  for (const [branch, name] of [
    ["feat/b", "old-b"],
    ["feat/source", "source-task"],
  ] as const) {
    gitHere("switch", "-q", branch);
    expect((await aidd(["task", name])).exitCode).toBe(0);
  }
  gitHere("switch", "-q", "feat/a");
}

describe("a branch is bound only by a declaration the command made on it", () => {
  it("does not give a copied branch the declaration of the branch it was copied from", async () => {
    await declareBranch();
    gitHere("branch", "-D", "feat/b");
    gitHere("branch", "-c", "feat/a", "feat/b");
    const tickets = rowsOf(await json("ticket"));
    expect(tickets["PROJ-1"]?.records).toBe(2);
    expect(tickets["no-binding"]?.records).toBe(1);
  });

  it("does not bind a branch on a task set by hand with no declaration time", async () => {
    gitHere("config", "--local", "branch.feat/b.aiddTask", "by-hand");
    const tasks = rowsOf(await json("task"));
    expect(tasks["by-hand"]).toBeUndefined();
    expect(tasks["no-binding"]?.records).toBe(3);
  });

  it("asks again after a rename, and one declaration on the new name covers it", async () => {
    await declareBranch();
    gitAt("2026-10-08T00:00:00Z", "branch", "-m", "feat/a", "feat/c");
    await addCall({
      id: "c1",
      session: S_BRANCH,
      at: "2026-10-08T12:00:00.000Z",
      branch: "feat/c",
      model: "m-big",
      input: 1,
      output: 1,
      read: 1,
      write: 1,
    });
    const renamed = rowsOf(await json("task"));
    expect(renamed.checkout?.records).toBe(2);
    expect(renamed["no-binding"]?.records).toBe(2);
    expect((await aidd(["task", "after-rename"])).exitCode).toBe(0);
    const declared = rowsOf(await json("task"));
    expect(declared.checkout?.records).toBe(2);
    expect(declared["after-rename"]?.records).toBe(1);
    expect(declared["no-binding"]?.records).toBe(1);
  });

  it("does not mix a declaration copied with -C into the one the branch already had", async () => {
    await declareBranch();
    gitHere("switch", "-q", "feat/b");
    expect((await aidd(["task", "--none"])).exitCode).toBe(0);
    gitHere("switch", "-q", "feat/a");
    gitHere("branch", "-C", "feat/a", "feat/b");
    const tickets = rowsOf(await json("ticket"));
    expect(tickets["PROJ-1"]?.records).toBe(2);
    expect(tickets["declared-none"]?.records).toBeGreaterThanOrEqual(1);
    expect(tickets["no-binding"]).toBeUndefined();
  });

  it("lets a declaration on a branch copied onto with -C reach the report, the source older", async () => {
    await declareOldBAndAnOlderSource();
    gitAt("2026-10-08T00:00:00Z", "branch", "-C", "feat/source", "feat/b");
    gitHere("switch", "-q", "feat/b");
    expect((await aidd(["task", "new-b"])).exitCode).toBe(0);
    await addCall(laterOnB);
    const tasks = rowsOf(await json("task"));
    expect(tasks["new-b"]?.records).toBe(1);
    expect(tasks["old-b"]?.records).toBe(1);
    expect(tasks["source-task"]).toBeUndefined();
  });

  it("lets a declaration on a name renamed onto, after the old branch was deleted, reach the report", async () => {
    await declareOldBAndAnOlderSource();
    gitHere("branch", "-D", "feat/b");
    gitAt("2026-10-08T00:00:00Z", "branch", "-m", "feat/source", "feat/b");
    gitHere("switch", "-q", "feat/b");
    expect((await aidd(["task", "new-b"])).exitCode).toBe(0);
    await addCall(laterOnB);
    const tasks = rowsOf(await json("task"));
    expect(tasks["new-b"]?.records).toBe(1);
    expect(tasks["old-b"]?.records).toBe(1);
  });

  it("still reads a declaration written before the branch was stamped", async () => {
    gitHere("config", "--local", "branch.feat/b.aiddTask", "legacy");
    gitHere("config", "--local", "branch.feat/b.aiddDeclaredAt", "2026-10-06T00:00:00.000Z");
    expect(rowsOf(await json("task")).legacy?.records).toBe(1);
  });
});
