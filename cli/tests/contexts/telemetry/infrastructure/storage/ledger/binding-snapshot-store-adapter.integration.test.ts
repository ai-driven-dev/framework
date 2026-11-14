import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type BranchSnapshot,
  snapshotKey,
} from "../../../../../../src/contexts/telemetry/domain/branch-binding.js";
import { BindingSnapshotStoreAdapter } from "../../../../../../src/contexts/telemetry/infrastructure/storage/ledger/binding-snapshot-store-adapter.js";
import { PrivateStorageAdapter } from "../../../../../../src/contexts/telemetry/infrastructure/storage/private-storage-adapter.js";
import { NO_ALIASES } from "../../../testing/no-aliases.js";

let root: string;
let dir: string;
let store: BindingSnapshotStoreAdapter;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-snapshots-"));
  dir = join(root, "bindings");
  store = new BindingSnapshotStoreAdapter(dir, new PrivateStorageAdapter(), NO_ALIASES);
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
