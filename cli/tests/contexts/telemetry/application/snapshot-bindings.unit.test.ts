import { describe, expect, it } from "vitest";
import { SnapshotBindings } from "../../../../src/contexts/telemetry/application/snapshot-bindings.js";
import type { BranchConfigBinding } from "../../../../src/contexts/telemetry/domain/branch-binding.js";
import { FakeBindings } from "../testing/fake-bindings.js";
import { InMemoryBindingsLock } from "../testing/in-memory-bindings-lock.js";
import { InMemorySnapshots } from "../testing/in-memory-snapshots.js";

const ROOT = "/repo";
const binding = (overrides: Partial<BranchConfigBinding> = {}): BranchConfigBinding => ({
  branch: "feat/x",
  task: "t",
  ticket: null,
  declared_at: "2026-10-07T10:00:00.000Z",
  none: false,
  ...overrides,
});

function setup() {
  const events: string[] = [];
  const source = new FakeBindings(events);
  const store = new InMemorySnapshots(events);
  const lock = new InMemoryBindingsLock(events);
  let clock = "2026-10-09T09:00:00.000Z";
  const useCase = new SnapshotBindings(source, store, lock, () => new Date(clock));
  return {
    source,
    store,
    events,
    useCase,
    at: (iso: string) => {
      clock = iso;
    },
  };
}

describe("snapshotting a repository's branch declarations", () => {
  it("records each declared branch with its creation time and the moment of the snapshot", async () => {
    const { source, store, useCase } = setup();
    source.bindingsByRoot.set(ROOT, [binding(), binding({ branch: "other", task: "o" })]);
    source.creation.set("feat/x", "2026-10-06T00:00:00.000Z");
    expect(await useCase.execute({ repositoryId: "repo-1", root: ROOT })).toBe(2);
    expect(store.appended).toHaveLength(2);
    expect(store.appended[0]).toEqual({
      repository_id: "repo-1",
      ...binding(),
      branch_created_at: "2026-10-06T00:00:00.000Z",
      snapshot_at: "2026-10-09T09:00:00.000Z",
    });
    expect(store.appended[1]?.branch_created_at).toBeNull();
  });

  it("reads the branch config, the latest snapshots and appends the new ones inside the bindings lock", async () => {
    const { source, events, useCase } = setup();
    source.bindingsByRoot.set(ROOT, [binding()]);
    await useCase.execute({ repositoryId: "repo-1", root: ROOT });
    // The branch config is read again under the lock: what an earlier read saw may be stale.
    expect(events.slice(events.indexOf("bindings-lock"))).toEqual([
      "bindings-lock",
      "read-config",
      "snapshot",
      "bindings-unlock",
    ]);
  });

  it("takes no lock when the repository declares nothing", async () => {
    const { events, useCase } = setup();
    await useCase.execute({ repositoryId: "repo-1", root: ROOT });
    expect(events).toEqual(["read-config"]);
  });

  it("adds nothing when every branch still reads as it did", async () => {
    const { source, store, useCase } = setup();
    source.bindingsByRoot.set(ROOT, [binding()]);
    source.creation.set("feat/x", "2026-10-06T00:00:00.000Z");
    await useCase.execute({ repositoryId: "repo-1", root: ROOT });
    expect(await useCase.execute({ repositoryId: "repo-1", root: ROOT })).toBe(0);
    expect(store.appended).toHaveLength(1);
  });

  it("adds a snapshot when a declaration changed, and keeps the earlier one", async () => {
    const { source, store, useCase, at } = setup();
    source.bindingsByRoot.set(ROOT, [binding()]);
    source.creation.set("feat/x", "2026-10-06T00:00:00.000Z");
    await useCase.execute({ repositoryId: "repo-1", root: ROOT });
    at("2026-10-10T09:00:00.000Z");
    source.bindingsByRoot.set(ROOT, [
      binding({ task: "renamed", declared_at: "2026-10-10T08:00:00.000Z" }),
    ]);
    expect(await useCase.execute({ repositoryId: "repo-1", root: ROOT })).toBe(1);
    expect(store.appended.map((s) => s.task)).toEqual(["t", "renamed"]);
  });

  it("keeps a deleted branch's snapshot: its absence from git adds and removes nothing", async () => {
    const { source, store, useCase } = setup();
    source.bindingsByRoot.set(ROOT, [binding()]);
    await useCase.execute({ repositoryId: "repo-1", root: ROOT });
    source.bindingsByRoot.set(ROOT, []);
    expect(await useCase.execute({ repositoryId: "repo-1", root: ROOT })).toBe(0);
    expect((await store.latest()).size).toBe(1);
  });

  it("does not ask the reflog again once a declaration has its creation time", async () => {
    const { source, useCase } = setup();
    source.bindingsByRoot.set(ROOT, [binding()]);
    source.creation.set("feat/x", "2026-10-06T00:00:00.000Z");
    await useCase.execute({ repositoryId: "repo-1", root: ROOT });
    await useCase.execute({ repositoryId: "repo-1", root: ROOT });
    expect(source.reflogReads).toBe(1);
  });

  it("keeps the earlier creation time when the reflog later reads a later one", async () => {
    const { source, store, useCase } = setup();
    source.bindingsByRoot.set(ROOT, [binding()]);
    source.creation.set("feat/x", "2026-10-06T00:00:00.000Z");
    await useCase.execute({ repositoryId: "repo-1", root: ROOT });
    source.creation.set("feat/x", "2026-12-01T00:00:00.000Z");
    await useCase.execute({ repositoryId: "repo-1", root: ROOT });
    expect(store.appended).toHaveLength(1);
  });

  it("fills in a creation time the reflog could not give at first", async () => {
    const { source, store, useCase } = setup();
    source.bindingsByRoot.set(ROOT, [binding()]);
    await useCase.execute({ repositoryId: "repo-1", root: ROOT });
    source.creation.set("feat/x", "2026-10-06T00:00:00.000Z");
    expect(await useCase.execute({ repositoryId: "repo-1", root: ROOT })).toBe(1);
    expect(store.appended.at(-1)?.branch_created_at).toBe("2026-10-06T00:00:00.000Z");
  });

  it("keeps two repositories' branches of one name apart", async () => {
    const { source, store, useCase } = setup();
    source.bindingsByRoot.set(ROOT, [binding()]);
    await useCase.execute({ repositoryId: "repo-1", root: ROOT });
    expect(await useCase.execute({ repositoryId: "repo-2", root: ROOT })).toBe(1);
    expect(store.appended.map((s) => s.repository_id)).toEqual(["repo-1", "repo-2"]);
  });

  it("writes nothing for a repository with no declared branch", async () => {
    const { store, useCase } = setup();
    expect(await useCase.execute({ repositoryId: "repo-1", root: ROOT })).toBe(0);
    expect(store.appended).toEqual([]);
  });

  it("does not even read what was snapshotted before when no branch is declared", async () => {
    const { store, useCase } = setup();
    await useCase.execute({ repositoryId: "repo-1", root: ROOT });
    expect(store.latestReads).toBe(0);
    expect(store.appendCalls).toBe(0);
  });

  it("does not append when nothing is new", async () => {
    const { source, store, useCase } = setup();
    source.bindingsByRoot.set(ROOT, [binding()]);
    await useCase.execute({ repositoryId: "repo-1", root: ROOT });
    await useCase.execute({ repositoryId: "repo-1", root: ROOT });
    expect(store.appendCalls).toBe(1);
  });
});
