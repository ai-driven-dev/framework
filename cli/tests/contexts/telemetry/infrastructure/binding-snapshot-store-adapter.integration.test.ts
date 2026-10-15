import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type BranchSnapshot,
  snapshotKey,
} from "../../../../src/contexts/telemetry/domain/branch-binding.js";
import { BindingSnapshotStoreAdapter } from "../../../../src/contexts/telemetry/infrastructure/binding-snapshot-store-adapter.js";
import { PrivateStorageAdapter } from "../../../../src/runtime/filesystem/private-storage-adapter.js";

let root: string;
let dir: string;
let store: BindingSnapshotStoreAdapter;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-snapshots-"));
  dir = join(root, "bindings");
  store = new BindingSnapshotStoreAdapter(dir, new PrivateStorageAdapter());
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function snapshot(overrides: Partial<BranchSnapshot> = {}): BranchSnapshot {
  return {
    repository_id: "r",
    branch: "feat/x",
    task: "t",
    ticket: null,
    declared_at: "2026-10-07T10:00:00.000Z",
    none: false,
    branch_created_at: "2026-10-06T00:00:00.000Z",
    snapshot_at: "2026-10-07T10:00:01.000Z",
    ...overrides,
  };
}

describe("the branch snapshots on disk", () => {
  it("are empty before the first", async () => {
    expect((await store.latest()).size).toBe(0);
  });

  it("keep every snapshot of a branch name in order, one generation after another", async () => {
    await store.append([snapshot({ task: "a" })]);
    await store.append([
      snapshot({ task: "b", branch_created_at: "2026-10-15T00:00:00.000Z" }),
      snapshot({ branch: "other" }),
    ]);
    const history = await store.history();
    expect(history.get(snapshotKey("r", "feat/x"))?.map((entry) => entry.task)).toEqual(["a", "b"]);
    expect(history.get(snapshotKey("r", "other"))).toHaveLength(1);
    expect((await store.latest()).get(snapshotKey("r", "feat/x"))?.task).toBe("b");
  });

  it("keep the latest snapshot of each branch of each repository", async () => {
    await store.append([snapshot({ task: "first" }), snapshot({ branch: "other" })]);
    await store.append([snapshot({ task: "second" }), snapshot({ repository_id: "r2" })]);
    const latest = await store.latest();
    expect(latest.get(snapshotKey("r", "feat/x"))?.task).toBe("second");
    expect(latest.get(snapshotKey("r", "other"))?.task).toBe("t");
    expect(latest.get(snapshotKey("r2", "feat/x"))?.task).toBe("t");
  });

  it("are only ever appended to", async () => {
    await store.append([snapshot({ task: "first" })]);
    await store.append([snapshot({ task: "second" })]);
    const lines = (await readFile(join(dir, "branches.jsonl"), "utf8")).trimEnd().split("\n");
    expect(lines.map((line) => JSON.parse(line).task)).toEqual(["first", "second"]);
  });

  it("start a new line after a crash left the last one without its newline", async () => {
    await store.append([snapshot({ task: "first" })]);
    const path = join(dir, "branches.jsonl");
    await writeFile(path, `${(await readFile(path, "utf8")).trimEnd()}\n{"torn":`);
    await store.append([snapshot({ task: "second" })]);
    const latest = await store.latest();
    expect(latest.get(snapshotKey("r", "feat/x"))?.task).toBe("second");
  });

  it("skip a line that is not a snapshot", async () => {
    await store.append([snapshot()]);
    const path = join(dir, "branches.jsonl");
    await writeFile(path, `${await readFile(path, "utf8")}garbage\n{"repository_id":""}\n`);
    expect((await store.latest()).size).toBe(1);
  });

  it.skipIf(process.platform === "win32")("are readable by their owner alone", async () => {
    await store.append([snapshot()]);
    expect((await stat(dir)).mode & 0o777).toBe(0o700);
    expect((await stat(join(dir, "branches.jsonl"))).mode & 0o777).toBe(0o600);
  });
});
