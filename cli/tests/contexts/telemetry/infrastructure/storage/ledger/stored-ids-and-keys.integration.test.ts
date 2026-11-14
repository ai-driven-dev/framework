import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderResolutions } from "../../../../../../src/contexts/telemetry/domain/repository-resolution.js";
import { RepositoryAliasStoreAdapter } from "../../../../../../src/contexts/telemetry/infrastructure/legacy/repository-alias-store-adapter.js";
import { BindingSnapshotStoreAdapter } from "../../../../../../src/contexts/telemetry/infrastructure/storage/ledger/binding-snapshot-store-adapter.js";
import { ResolutionStoreAdapter } from "../../../../../../src/contexts/telemetry/infrastructure/storage/ledger/resolution-store-adapter.js";
import { UsageLedgerAdapter } from "../../../../../../src/contexts/telemetry/infrastructure/storage/ledger/usage-ledger-adapter.js";
import { PrivateStorageAdapter } from "../../../../../../src/contexts/telemetry/infrastructure/storage/private-storage-adapter.js";
import { cloneOf } from "../../../testing/clone-builders.js";

let dir: string;
let bindings: string;
const storage = new PrivateStorageAdapter();

beforeEach(async () => {
  const root = await mkdtemp(join(tmpdir(), "aidd-ids-"));
  dir = join(root, "ledger");
  bindings = join(root, "bindings");
  await mkdir(dir, { recursive: true });
  await mkdir(bindings, { recursive: true });
});
afterEach(async () => {
  await rm(join(dir, ".."), { recursive: true, force: true });
});

const OLD = "an-id-an-earlier-version-gave";
const NEW = "the-id-of-now";

function call(overrides: Record<string, unknown> = {}) {
  return {
    tool: "claude-code",
    tool_version: "2",
    key: "msg_A:req_A",
    session_id: "s-1",
    agent: "main",
    at: "2026-10-07T23:59:59.000Z",
    model: "m",
    input: 1,
    output: 1,
    cache_read: 0,
    cache_write: 0,
    cache_write_1h: null,
    reasoning: null,
    cwd: "/work/a",
    git_branch: null,
    repository_id: OLD,
    ...overrides,
  };
}

async function writeAliases(): Promise<void> {
  await writeFile(
    join(dir, "repository-ids.json"),
    `${JSON.stringify({ version: 1, aliases: { [OLD]: NEW } }, null, 2)}\n`
  );
}

describe("the ledger, read after the rules changed", () => {
  it("reads a call with no request id, as any version keyed it, as a line it does not accept, and keeps it as found", async () => {
    await writeAliases();
    const kept = call({ key: "msg_B:req_B", at: "2026-10-08T00:00:01.000Z" });
    const copies = [
      call({ key: "msg_A:s-1:2026-10-08T00:00:02.000Z", at: "2026-10-08T00:00:02.000Z" }),
      call({ key: "msg_A:s-1#advisor0", at: "2026-10-08T00:00:03.000Z" }),
    ];
    const text = `${[kept, ...copies].map((line) => JSON.stringify(line)).join("\n")}\n`;
    await writeFile(join(dir, "2026-10-08.jsonl"), text);
    const ledger = new UsageLedgerAdapter(dir, storage);
    const held = await ledger.load();
    expect(held.records).toEqual([{ ...kept, repository_id: NEW }]);
    expect(held.skippedLines).toBe(2);
    expect(held.unsettled).toEqual(new Set(["2026-10-08"]));
    await ledger.save(held.records, new Set(["2026-10-08"]));
    expect(await readFile(join(dir, "2026-10-08.jsonl"), "utf8")).toBe(
      `${[
        JSON.stringify({ ...kept, repository_id: NEW }),
        ...copies.map((line) => JSON.stringify(line)).sort(),
      ].join("\n")}\n`
    );
    expect(await ledger.leftOut.counts()).toEqual({ undated: 0, unrecognised: 0, requestless: 0 });
  });

  it("leaves a call named by the id of now as settled", async () => {
    await writeAliases();
    const now = call({ repository_id: NEW });
    await writeFile(join(dir, "2026-10-07.jsonl"), `${JSON.stringify(now)}\n`);
    const held = await new UsageLedgerAdapter(dir, storage).load();
    expect(held.records).toEqual([now]);
    expect(held.unsettled.size).toBe(0);
  });
});

describe("roots.json and branch snapshots, read after the rules changed", () => {
  const clone = cloneOf("/work/a/.git");
  const seen = { dir: "/work/a", root: "/work/a", clone, seen_at: "2026-10-01T00:00:00.000Z" };

  it("name each repository by its id of now", async () => {
    await writeAliases();
    await writeFile(
      join(dir, "roots.json"),
      renderResolutions(new Map([["k", { ...seen, repository_id: OLD }]]))
    );
    const loaded = await new ResolutionStoreAdapter(dir, storage).load();
    expect([...loaded.values()].map((r) => r.repository_id)).toEqual([NEW]);
  });

  it("join an earlier id's snapshots to the history of its id of now, the file untouched", async () => {
    await writeAliases();
    const snapshot = (id: string, task: string) =>
      JSON.stringify({
        branch: "feat/x",
        task,
        ticket: null,
        declared_at: "2026-10-01T00:00:00.000Z",
        none: false,
        repository_id: id,
        branch_created_at: null,
        snapshot_at: "2026-10-01T00:00:00.000Z",
      });
    const text = `${snapshot(OLD, "one")}\n${snapshot(NEW, "two")}\n`;
    await writeFile(join(bindings, "branches.jsonl"), text);
    const store = new BindingSnapshotStoreAdapter(
      bindings,
      storage,
      new RepositoryAliasStoreAdapter(dir)
    );
    const history = await store.history();
    expect([...history.keys()]).toEqual([`${NEW}\u0000feat/x`]);
    expect(history.get(`${NEW}\u0000feat/x`)?.map((s) => s.task)).toEqual(["one", "two"]);
    expect((await store.latest()).get(`${NEW}\u0000feat/x`)?.task).toBe("two");
    expect(await readFile(join(bindings, "branches.jsonl"), "utf8")).toBe(text);
  });
});
