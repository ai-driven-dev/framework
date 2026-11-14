import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SnapshotBindings } from "../../../../../../src/contexts/telemetry/application/snapshot-bindings.js";
import { BindingsLockAdapter } from "../../../../../../src/contexts/telemetry/infrastructure/storage/declarations/bindings-lock-adapter.js";
import { BindingSnapshotStoreAdapter } from "../../../../../../src/contexts/telemetry/infrastructure/storage/ledger/binding-snapshot-store-adapter.js";
import { UsageLedgerAdapter } from "../../../../../../src/contexts/telemetry/infrastructure/storage/ledger/usage-ledger-adapter.js";
import { PrivateStorageAdapter } from "../../../../../../src/contexts/telemetry/infrastructure/storage/private-storage-adapter.js";
import { FakeBindings } from "../../../testing/fake-bindings.js";
import { NO_ALIASES } from "../../../testing/no-aliases.js";

let root: string;
const storage = new PrivateStorageAdapter();

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-bindings-lock-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("the bindings lock", () => {
  it("is granted while another process holds the ledger lock", async () => {
    const ledger = new UsageLedgerAdapter(join(root, "ledger"), storage);
    const bindings = new BindingsLockAdapter(join(root, "bindings"), storage, {
      waitMs: 200,
      pollMs: 10,
    });
    const reached = await ledger.exclusively(() => bindings.exclusively(async () => "reached"));
    expect(reached).toBe("reached");
  });

  it("names itself, and its own file, when it times out", async () => {
    const dir = join(root, "bindings");
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, ".lock"),
      JSON.stringify({ pid: 4242, created_at: new Date().toISOString() })
    );
    const bindings = new BindingsLockAdapter(dir, storage, {
      isAlive: () => true,
      waitMs: 0,
    });
    const failure = await bindings.exclusively(async () => "unreachable").catch((e: Error) => e);
    expect(failure).toBeInstanceOf(Error);
    const message = (failure as Error).message;
    expect(message).toContain("The telemetry bindings store is locked by process 4242");
    expect(message).toContain(join(dir, ".lock"));
    expect(message).not.toContain("ledger");
  });

  it("gives up after the wait a caller asks for, not the adapter's own", async () => {
    const dir = join(root, "bindings");
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, ".lock"),
      JSON.stringify({ pid: 4242, created_at: new Date().toISOString() })
    );
    const bindings = new BindingsLockAdapter(dir, storage, {
      isAlive: () => true,
      waitMs: 60_000,
      sleep: () => Promise.reject(new Error("waited the adapter's own minute")),
    });
    const failure = await bindings
      .exclusively(async () => "unreachable", { waitMs: 0 })
      .catch((e: Error) => e);
    expect((failure as Error).message).toContain("is locked by process 4242");
  });

  it("leaves one snapshot when a declaration and an ingest snapshot the same branch at once", async () => {
    const dir = join(root, "bindings");
    const source = new FakeBindings();
    source.bindingsByRoot.set("/repo", [
      {
        branch: "feat/x",
        task: "t",
        ticket: null,
        declared_at: "2026-10-07T10:00:00.000Z",
        none: false,
      },
    ]);
    const snapshotter = () =>
      new SnapshotBindings(
        source,
        new BindingSnapshotStoreAdapter(dir, storage, NO_ALIASES),
        new BindingsLockAdapter(dir, storage),
        () => new Date("2026-10-09T09:00:00.000Z")
      );
    const added = await Promise.all([
      snapshotter().execute({ repositoryId: "repo-1", root: "/repo" }),
      snapshotter().execute({ repositoryId: "repo-1", root: "/repo" }),
      snapshotter().execute({ repositoryId: "repo-1", root: "/repo" }),
    ]);
    expect(added.reduce((sum, n) => sum + n, 0)).toBe(1);
    const lines = (await readFile(join(dir, "branches.jsonl"), "utf8")).split("\n").filter(Boolean);
    expect(lines).toHaveLength(1);
  });
});
