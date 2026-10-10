import { describe, expect, it } from "vitest";
import { BranchDeclarations } from "../../../../src/contexts/telemetry/application/branch-declarations.js";
import { ConsentedRepositories } from "../../../../src/contexts/telemetry/application/consented-repositories.js";
import { DeclareTaskUseCase } from "../../../../src/contexts/telemetry/application/declare-task-use-case.js";
import { SnapshotBindingsUseCase } from "../../../../src/contexts/telemetry/application/snapshot-bindings-use-case.js";
import type { DeclarationRequest } from "../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
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
const GRANTED = "2";
const REPOSITORY: LocatedDirectory = {
  status: "repository",
  root: CWD,
  mainRoot: CWD,
  remote: "git@github.com:acme/widgets.git",
  rootCommit: "abc",
};
const TASK: DeclarationRequest = { kind: "task", task: "checkout-fix", ticket: "PROJ-12" };

function setup(options: { refusedByEnvironment?: boolean; sessionId?: string | null } = {}) {
  const events: string[] = [];
  const locator = new FakeLocator();
  locator.directories.set(CWD, REPOSITORY);
  const consents = new FakeConsents();
  consents.values.set(CWD, GRANTED);
  const sessions = new InMemorySessions(events);
  const branches = new FakeBranchStore(events);
  const lock = new InMemoryBindingsLock(events);
  const source = new FakeBindings();
  const snapshotStore = new InMemorySnapshots(events);
  const snapshots = new SnapshotBindingsUseCase(
    source,
    snapshotStore,
    lock,
    () => new Date("2026-10-09T10:00:01.000Z")
  );
  const useCase = new DeclareTaskUseCase(
    new ConsentedRepositories(locator, consents),
    sessions,
    new BranchDeclarations(branches, source, snapshots),
    lock,
    {
      refusedByEnvironment: options.refusedByEnvironment ?? false,
      sessionId: options.sessionId === undefined ? "sess-1234567890" : options.sessionId,
      now: () => new Date("2026-10-09T10:00:00.000Z"),
    }
  );
  return { useCase, locator, consents, sessions, branches, source, snapshotStore, events };
}

describe("declaring a task", () => {
  it("binds the session from now and the working branch, then snapshots at once", async () => {
    const { useCase, sessions, branches, source, snapshotStore, events } = setup();
    source.bindingsByRoot.set(CWD, [
      {
        branch: "feat/x",
        task: "checkout-fix",
        ticket: "PROJ-12",
        declared_at: "2026-10-09T10:00:00.000Z",
        none: false,
      },
    ]);
    const result = await useCase.execute({ cwd: CWD, request: TASK, by: "command" });
    expect(result).toMatchObject({
      status: "declared",
      sessionId: "sess-1234567890",
      branch: { status: "bound", branch: "feat/x" },
    });
    expect(sessions.lines).toEqual([
      {
        session_id: "sess-1234567890",
        task: "checkout-fix",
        ticket: "PROJ-12",
        none: false,
        declared_at: "2026-10-09T10:00:00.000Z",
        by: "command",
      },
    ]);
    expect(branches.declared).toHaveLength(1);
    expect(branches.declared[0]).toMatchObject({ root: CWD, branch: "feat/x" });
    // The snapshot sees the declaration, so it follows the git config write. The session line
    // and the snapshot each take the bindings lock, one after the other, and never the ledger's.
    expect(events).toEqual([
      "bindings-lock",
      "append",
      "bindings-unlock",
      "declare",
      "bindings-lock",
      "snapshot",
      "bindings-unlock",
    ]);
    expect(snapshotStore.appended).toHaveLength(1);
  });

  it("carries the declarer into the stored line", async () => {
    const { useCase, sessions } = setup();
    await useCase.execute({ cwd: CWD, request: TASK, by: "hook-intercept" });
    expect(sessions.lines[0]?.by).toBe("hook-intercept");
  });

  it("declares none as none, with neither task nor ticket", async () => {
    const { useCase, sessions, branches } = setup();
    await useCase.execute({ cwd: CWD, request: { kind: "none" }, by: "command" });
    expect(sessions.lines[0]).toMatchObject({ task: null, ticket: null, none: true });
    expect(branches.declared[0]?.declaration).toMatchObject({
      task: null,
      ticket: null,
      none: true,
    });
  });

  it("keeps both declarations of one session, each with its own time", async () => {
    const { useCase, sessions } = setup();
    await useCase.execute({ cwd: CWD, request: TASK, by: "command" });
    await useCase.execute({ cwd: CWD, request: { kind: "none" }, by: "command" });
    expect(sessions.lines.map((line) => line.none)).toEqual([false, true]);
  });

  it("binds the session only, and says so, on the default branch", async () => {
    const { useCase, sessions, branches, events } = setup();
    branches.heads_ = { head: "refs/heads/main", originHead: "refs/remotes/origin/main" };
    const result = await useCase.execute({ cwd: CWD, request: TASK, by: "command" });
    expect(result).toMatchObject({
      status: "declared",
      branch: { status: "untouched", reason: "default-branch", branch: "main" },
    });
    expect(branches.declared).toEqual([]);
    expect(sessions.lines).toHaveLength(1);
    expect(events).toEqual(["bindings-lock", "append", "bindings-unlock"]);
  });

  it("binds the session only, and says so, on a detached head", async () => {
    const { useCase, branches } = setup();
    branches.heads_ = { head: null, originHead: null };
    const result = await useCase.execute({ cwd: CWD, request: TASK, by: "command" });
    expect(result).toMatchObject({
      branch: { status: "untouched", reason: "detached", branch: null },
    });
    expect(branches.declared).toEqual([]);
  });

  it("binds the branch only outside a session", async () => {
    const { useCase, sessions, branches } = setup({ sessionId: null });
    const result = await useCase.execute({ cwd: CWD, request: TASK, by: "command" });
    expect(result).toMatchObject({ sessionId: null, branch: { status: "bound" } });
    expect(sessions.lines).toEqual([]);
    expect(branches.declared).toHaveLength(1);
  });
});

describe("refusing to declare", () => {
  it("refuses a project that has not opted in, and writes nothing", async () => {
    const { useCase, consents, sessions, branches, events } = setup();
    consents.values.set(CWD, "true");
    expect(await useCase.execute({ cwd: CWD, request: TASK, by: "command" })).toEqual({
      status: "refused",
      reason: "no-consent",
    });
    expect(sessions.lines).toEqual([]);
    expect(branches.declared).toEqual([]);
    expect(events).toEqual([]);
  });

  it("refuses a clone with no consent, and one whose git config cannot be read, differently", async () => {
    const none = setup();
    none.consents.values.delete(CWD);
    expect(await none.useCase.execute({ cwd: CWD, request: TASK, by: "command" })).toMatchObject({
      reason: "no-consent",
    });
    const broken = setup();
    broken.consents.unreadable.add(CWD);
    expect(await broken.useCase.execute({ cwd: CWD, request: TASK, by: "command" })).toMatchObject({
      reason: "unreadable-consent",
    });
  });

  it("asks a linked worktree's own root, which shares the main clone's git config", async () => {
    const { useCase, locator, consents } = setup();
    locator.directories.set(CWD, { ...REPOSITORY, root: CWD, mainRoot: "/work/main" });
    await useCase.execute({ cwd: CWD, request: TASK, by: "command" });
    expect(consents.reads).toEqual([CWD]);
  });

  it("refuses under AIDD_TELEMETRY=0 before reading anything", async () => {
    const { useCase, locator, sessions } = setup({ refusedByEnvironment: true });
    expect(await useCase.execute({ cwd: CWD, request: TASK, by: "command" })).toEqual({
      status: "refused",
      reason: "environment",
    });
    expect(locator.asked).toEqual([]);
    expect(sessions.lines).toEqual([]);
  });

  it("refuses outside a repository, and in one nothing can name", async () => {
    const outside = setup();
    outside.locator.directories.set(CWD, { status: "outside-repository" });
    expect(await outside.useCase.execute({ cwd: CWD, request: TASK, by: "command" })).toMatchObject(
      {
        reason: "outside-repository",
      }
    );
    const unnamed = setup();
    unnamed.locator.directories.set(CWD, { ...REPOSITORY, remote: null, rootCommit: null });
    expect(await unnamed.useCase.execute({ cwd: CWD, request: TASK, by: "command" })).toMatchObject(
      {
        reason: "unidentified-repository",
      }
    );
    expect(unnamed.sessions.lines).toEqual([]);
  });
});
