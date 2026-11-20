import { describe, expect, it } from "vitest";
import { DeclareOnBranch } from "../../../../../src/contexts/telemetry/application/declaration/declare-on-branch.js";
import { SnapshotBindings } from "../../../../../src/contexts/telemetry/application/snapshot-bindings.js";
import type { TaskDeclaration } from "../../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import { FakeBindings } from "../../testing/fake-bindings.fake.js";
import { FakeBranchStore } from "../../testing/fake-branch-store.fake.js";
import { InMemoryBindingsLock } from "../../testing/in-memory-bindings-lock.fake.js";
import { InMemorySnapshots } from "../../testing/in-memory-snapshots.fake.js";

const ROOT = "/work/repo";
const DECLARATION: TaskDeclaration = {
  task: "checkout-fix",
  ticket: "PROJ-12",
  none: false,
  declared_at: "2026-10-09T10:00:00.000Z",
  by: "command",
};

function setup(head: string | null) {
  const events: string[] = [];
  const store = new FakeBranchStore(events);
  store.heads_ = { head, originHead: null };
  const source = new FakeBindings();
  const snapshots = new InMemorySnapshots(events);
  source.bindingsByRoot.set(ROOT, [
    { branch: "feat/x", task: "checkout-fix", ticket: "PROJ-12", declared_at: null, none: false },
  ]);
  const useCase = new DeclareOnBranch(
    store,
    new SnapshotBindings(source, snapshots, new InMemoryBindingsLock(events), () => new Date())
  );
  return { events, store, useCase };
}

const command = { repositoryId: "r1", root: ROOT, declaration: DECLARATION };

describe("declaring on the branch being worked on", () => {
  it("declares on a working branch, then snapshots what it declares", async () => {
    const { events, store, useCase } = setup("refs/heads/feat/x");
    expect(await useCase.execute(command)).toEqual({ status: "bound", branch: "feat/x" });
    expect(store.declared).toEqual([{ root: ROOT, branch: "feat/x", declaration: DECLARATION }]);
    expect(events.indexOf("declare")).toBeLessThan(events.indexOf("snapshot"));
  });

  it("leaves the default branch alone", async () => {
    const { events, useCase } = setup("refs/heads/main");
    expect(await useCase.execute(command)).toEqual({
      status: "untouched",
      reason: "default-branch",
      branch: "main",
    });
    expect(events).toEqual([]);
  });

  it("leaves a detached head alone", async () => {
    const { events, useCase } = setup(null);
    expect(await useCase.execute(command)).toEqual({
      status: "untouched",
      reason: "detached",
      branch: null,
    });
    expect(events).toEqual([]);
  });
});
