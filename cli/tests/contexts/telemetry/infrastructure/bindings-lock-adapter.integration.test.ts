import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SnapshotBindingsUseCase } from "../../../../src/contexts/telemetry/application/snapshot-bindings-use-case.js";
import { BindingSnapshotStoreAdapter } from "../../../../src/contexts/telemetry/infrastructure/binding-snapshot-store-adapter.js";
import { BindingsLockAdapter } from "../../../../src/contexts/telemetry/infrastructure/bindings-lock-adapter.js";
import { UsageLedgerAdapter } from "../../../../src/contexts/telemetry/infrastructure/usage-ledger-adapter.js";
import { PrivateStorageAdapter } from "../../../../src/runtime/filesystem/private-storage-adapter.js";
import { FakeBindings } from "../../../helpers/ports/in-memory-telemetry.js";

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

  it("makes two writers take turns: a second waits for the first to finish", async () => {
    const bindings = new BindingsLockAdapter(join(root, "bindings"), storage);
    const order: string[] = [];
    const slow = bindings.exclusively(async () => {
      order.push("slow in");
      await new Promise((done) => setTimeout(done, 150));
      order.push("slow out");
    });
    await new Promise((done) => setTimeout(done, 30));
    const quick = bindings.exclusively(async () => {
      order.push("quick in");
    });
    await Promise.all([slow, quick]);
    expect(order).toEqual(["slow in", "slow out", "quick in"]);
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
      new SnapshotBindingsUseCase(
        source,
        new BindingSnapshotStoreAdapter(dir, storage),
        new BindingsLockAdapter(dir, storage),
        () => new Date("2026-10-09T09:00:00.000Z")
      );
    const added = await Promise.all([
      snapshotter().execute("repo-1", "/repo"),
      snapshotter().execute("repo-1", "/repo"),
      snapshotter().execute("repo-1", "/repo"),
    ]);
    expect(added.reduce((sum, n) => sum + n, 0)).toBe(1);
    const lines = (await readFile(join(dir, "branches.jsonl"), "utf8")).split("\n").filter(Boolean);
    expect(lines).toHaveLength(1);
  });
});
