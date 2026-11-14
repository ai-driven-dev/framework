import { describe, expect, it } from "vitest";
import { SnapshotBindings } from "../../../../src/contexts/telemetry/application/snapshot-bindings.js";
import { FakeBindings } from "../testing/fake-bindings.js";
import { InMemoryBindingsLock } from "../testing/in-memory-bindings-lock.js";
import { InMemorySnapshots } from "../testing/in-memory-snapshots.js";

const ROOT = "/repo";
const DECLARED = { branch: "feat/x", task: "t", ticket: null, declared_at: "d", none: false };

function setup() {
  const events: string[] = [];
  const source = new FakeBindings(events);
  const store = new InMemorySnapshots(events);
  const useCase = new SnapshotBindings(
    source,
    store,
    new InMemoryBindingsLock(events),
    () => new Date(0)
  );
  const run = () => useCase.execute({ repositoryId: "r", root: ROOT });
  return { source, store, events, run };
}

describe("snapshotting a repository's branch declarations", () => {
  it("reads the branch config again, and appends, inside the bindings lock", async () => {
    const { source, events, run } = setup();
    source.bindingsByRoot.set(ROOT, [DECLARED]);
    await run();
    expect(events.slice(events.indexOf("bindings-lock"))).toEqual([
      "bindings-lock",
      "read-config",
      "snapshot",
      "bindings-unlock",
    ]);
  });

  it("takes no lock, reads no snapshot and writes nothing when nothing is declared", async () => {
    const { store, events, run } = setup();
    expect(await run()).toBe(0);
    expect([events, store.latestReads, store.appendCalls]).toEqual([["read-config"], 0, 0]);
  });

  it("asks the reflog once, and appends once, when nothing changes between two runs", async () => {
    const { source, store, run } = setup();
    source.bindingsByRoot.set(ROOT, [DECLARED]);
    source.creation.set("feat/x", "2026-10-06T00:00:00.000Z");
    await run();
    await run();
    expect([source.reflogReads, store.appendCalls]).toEqual([1, 1]);
  });
});
