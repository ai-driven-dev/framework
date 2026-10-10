import { describe, expect, it } from "vitest";
import { BranchDeclarations } from "../../../../src/contexts/telemetry/application/branch-declarations.js";
import { ConsentedRepositories } from "../../../../src/contexts/telemetry/application/consented-repositories.js";
import { ShowTaskBindingUseCase } from "../../../../src/contexts/telemetry/application/show-task-binding-use-case.js";
import { SnapshotBindingsUseCase } from "../../../../src/contexts/telemetry/application/snapshot-bindings-use-case.js";
import type { LocatedDirectory } from "../../../../src/contexts/telemetry/domain/ports/repository-locator.js";
import {
  FakeBindings,
  FakeBranchStore,
  FakeConsents,
  FakeLocator,
  InMemoryBindingsLock,
  InMemorySessions,
  InMemorySnapshots,
} from "../../../helpers/ports/in-memory-telemetry.js";

const CWD = "/work/repo";
const REPOSITORY: LocatedDirectory = {
  status: "repository",
  root: CWD,
  mainRoot: CWD,
  clone: `${CWD}/.git`,
  remote: "git@github.com:acme/widgets.git",
  rootCommit: "abc",
};

function setup(sessionId: string | null = "sess-1234567890", refusedByEnvironment = false) {
  const locator = new FakeLocator();
  locator.directories.set(CWD, REPOSITORY);
  const consents = new FakeConsents();
  consents.values.set(CWD, "2");
  const sessions = new InMemorySessions();
  const branches = new FakeBranchStore();
  const source = new FakeBindings();
  const useCase = new ShowTaskBindingUseCase(
    new ConsentedRepositories(locator, consents),
    sessions,
    new BranchDeclarations(
      branches,
      source,
      new SnapshotBindingsUseCase(
        source,
        new InMemorySnapshots(),
        new InMemoryBindingsLock(),
        () => new Date()
      )
    ),
    { refusedByEnvironment, sessionId, now: () => new Date("2026-10-09T12:00:00.000Z") }
  );
  return { useCase, consents, sessions, branches, source };
}

const branchBinding = {
  branch: "feat/x",
  task: "on-branch",
  ticket: null,
  declared_at: "2026-10-09T09:00:00.000Z",
  none: false,
};

describe("showing what the work is bound to", () => {
  it("is the session's declaration before the branch's", async () => {
    const { useCase, sessions, source } = setup();
    source.bindingsByRoot.set(CWD, [branchBinding]);
    sessions.lines.push({
      session_id: "sess-1234567890",
      task: "in-session",
      ticket: null,
      none: false,
      declared_at: "2026-10-09T11:00:00.000Z",
      by: "command",
    });
    expect(await useCase.execute(CWD)).toMatchObject({
      status: "shown",
      branch: "feat/x",
      role: "working",
      binding: { source: "session-declared", task: "in-session" },
    });
  });

  it("is the branch's declaration for the branch being worked on, not another's", async () => {
    const { useCase, source } = setup();
    source.bindingsByRoot.set(CWD, [
      { ...branchBinding, branch: "other", task: "elsewhere" },
      branchBinding,
    ]);
    expect(await useCase.execute(CWD)).toMatchObject({
      binding: { source: "branch", task: "on-branch" },
    });
  });

  it("reads the carries of a session", async () => {
    const { useCase, sessions } = setup();
    sessions.lines.push({
      session_id: "earlier",
      task: "carried-task",
      ticket: null,
      none: false,
      declared_at: "2026-10-09T09:00:00.000Z",
      by: "command",
    });
    sessions.carried.push({
      session_id: "sess-1234567890",
      from: "earlier",
      at: "2026-10-09T10:00:00.000Z",
    });
    expect(await useCase.execute(CWD)).toMatchObject({
      binding: { source: "session-carried", task: "carried-task", carriedFrom: "earlier" },
    });
  });

  it("never reads the branch's declaration on the default branch or a detached head", async () => {
    const { useCase, branches, source } = setup();
    source.bindingsByRoot.set(CWD, [{ ...branchBinding, branch: "main" }]);
    branches.heads_ = { head: "refs/heads/main", originHead: "refs/remotes/origin/main" };
    expect(await useCase.execute(CWD)).toMatchObject({
      role: "default",
      binding: { state: "unbound" },
    });
    branches.heads_ = { head: null, originHead: null };
    expect(await useCase.execute(CWD)).toMatchObject({
      role: "detached",
      binding: { state: "unbound" },
    });
  });

  it("is unbound when nothing is declared", async () => {
    expect(await setup(null).useCase.execute(CWD)).toMatchObject({
      status: "shown",
      sessionId: null,
      binding: { state: "unbound" },
    });
  });

  it("refuses like a declaration does", async () => {
    const optedOut = setup();
    optedOut.consents.values.set(CWD, "{}");
    expect(await optedOut.useCase.execute(CWD)).toEqual({
      status: "refused",
      reason: "no-consent",
    });
    expect(await setup("s", true).useCase.execute(CWD)).toEqual({
      status: "refused",
      reason: "environment",
    });
  });
});
