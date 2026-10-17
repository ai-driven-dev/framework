import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoredUsageMigration } from "../../../../src/contexts/telemetry/application/legacy/stored-usage-migration.js";
import { legacyRepositoryIdOf } from "../../../../src/contexts/telemetry/domain/legacy/legacy-repository-identity.js";
import type { PrivateStorage } from "../../../../src/contexts/telemetry/domain/ports/private-storage.js";
import { repositoryIdOf } from "../../../../src/contexts/telemetry/domain/repository-identity.js";
import { renderResolutions } from "../../../../src/contexts/telemetry/domain/repository-resolution.js";
import { BindingSnapshotStoreAdapter } from "../../../../src/contexts/telemetry/infrastructure/binding-snapshot-store-adapter.js";
import { RepositoryAliasStoreAdapter } from "../../../../src/contexts/telemetry/infrastructure/legacy/repository-alias-store-adapter.js";
import { ResolutionStoreAdapter } from "../../../../src/contexts/telemetry/infrastructure/resolution-store-adapter.js";
import { UsageLedgerAdapter } from "../../../../src/contexts/telemetry/infrastructure/usage-ledger-adapter.js";
import { PrivateStorageAdapter } from "../../../../src/runtime/filesystem/private-storage-adapter.js";
import { FailingStorage } from "../../../helpers/ports/failing-private-storage.js";
import { cloneOf, FakeLocator } from "../../../helpers/ports/in-memory-telemetry.js";

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

const MIXED = { remote: "git@github.com:Acme/Tool.git", rootCommit: "c0ffee" };
const OLD = legacyRepositoryIdOf(MIXED) as string;
const NEW = repositoryIdOf(MIXED) as string;

function call(overrides: Record<string, unknown> = {}) {
  return {
    tool: "claude-code",
    tool_version: "2",
    key: "msg_A:s-1:2026-10-07T23:59:59.000Z",
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

async function writeAliases(complete = true): Promise<void> {
  await writeFile(
    join(dir, "repository-ids.json"),
    `${JSON.stringify({ version: 1, complete, aliases: { [OLD]: NEW }, pending: [] }, null, 2)}\n`
  );
}

describe("the ledger, read after the rules changed", () => {
  it("re-keys a requestless call's copies stored apart, re-ids them, and counts the call once", async () => {
    await writeAliases();
    await writeFile(join(dir, "2026-10-07.jsonl"), `${JSON.stringify(call())}\n`);
    const later = call({
      key: "msg_A:s-1:2026-10-08T00:00:02.000Z",
      at: "2026-10-08T00:00:02.000Z",
      output: 9,
    });
    await writeFile(join(dir, "2026-10-08.jsonl"), `${JSON.stringify(later)}\n`);
    const ledger = new UsageLedgerAdapter(dir, storage);
    const held = await ledger.load();
    expect(held.records).toEqual([{ ...later, key: "msg_A:s-1", repository_id: NEW }]);
    expect([...held.unsettled].sort()).toEqual(["2026-10-07", "2026-10-08"]);
    await ledger.save(held.records, held.unsettled);
    expect(await readFile(join(dir, "2026-10-08.jsonl"), "utf8")).toBe(
      `${JSON.stringify({ ...later, key: "msg_A:s-1", repository_id: NEW })}\n`
    );
    await expect(readFile(join(dir, "2026-10-07.jsonl"), "utf8")).rejects.toThrow();
  });

  it("folds a line an earlier version writes after the migration into the call it is a copy of", async () => {
    await writeAliases();
    const now = call({ key: "msg_A:s-1", repository_id: NEW, output: 5 });
    await writeFile(
      join(dir, "2026-10-07.jsonl"),
      `${JSON.stringify(now)}\n${JSON.stringify(call({ output: 2 }))}\n`
    );
    const held = await new UsageLedgerAdapter(dir, storage).load();
    expect(held.records).toEqual([now]);
  });

  it("leaves a call keyed and named by the rules of now as settled", async () => {
    await writeAliases();
    const now = call({ key: "msg_A:req_A", repository_id: NEW });
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
      new RepositoryAliasStoreAdapter(dir, storage)
    );
    const history = await store.history();
    expect([...history.keys()]).toEqual([`${NEW}\u0000feat/x`]);
    expect(history.get(`${NEW}\u0000feat/x`)?.map((s) => s.task)).toEqual(["one", "two"]);
    expect((await store.latest()).get(`${NEW}\u0000feat/x`)?.task).toBe("two");
    expect(await readFile(join(bindings, "branches.jsonl"), "utf8")).toBe(text);
  });
});

describe("the migration", () => {
  function migration(locator: FakeLocator, store: PrivateStorage = storage) {
    const ledger = new UsageLedgerAdapter(dir, store);
    return new StoredUsageMigration(
      locator,
      new ResolutionStoreAdapter(dir, store),
      new RepositoryAliasStoreAdapter(dir, store),
      ledger
    );
  }
  const live = (remote: string | null) => ({
    status: "repository" as const,
    root: "/work/a",
    mainRoot: "/work/a",
    clone: cloneOf("/work/a/.git"),
    remote,
    rootCommit: "c0ffee",
  });
  const rooted = async (...roots: string[]) =>
    writeFile(
      join(dir, "roots.json"),
      renderResolutions(
        new Map(
          roots.map((r) => [
            r,
            {
              dir: r,
              root: r,
              repository_id: OLD,
              clone: cloneOf(`${r}/.git`),
              seen_at: "2026-10-01T00:00:00.000Z",
            },
          ])
        )
      )
    );
  const table = async () => JSON.parse(await readFile(join(dir, "repository-ids.json"), "utf8"));

  it("maps the id an earlier version gave each live root's origin to the id of now, and rewrites roots.json and the ledger", async () => {
    await rooted("/work/a", "/work/gone");
    await writeFile(join(dir, "2026-10-07.jsonl"), `${JSON.stringify(call())}\n`);
    const locator = new FakeLocator();
    locator.directories.set("/work/a", live(MIXED.remote));
    await migration(locator).execute();
    expect(await table()).toEqual({
      version: 1,
      complete: true,
      aliases: { [OLD]: NEW },
      pending: ["/work/gone"],
    });
    expect(locator.asked).toEqual(["/work/a", "/work/gone"]);
    expect(await readFile(join(dir, "roots.json"), "utf8")).not.toContain(OLD);
    expect(await readFile(join(dir, "2026-10-07.jsonl"), "utf8")).toBe(
      `${JSON.stringify(call({ key: "msg_A:s-1", repository_id: NEW }))}\n`
    );
  });

  it("maps nothing for an origin both rules name alike, nor for a root with no origin", async () => {
    await rooted("/work/a", "/work/b", "/work/c");
    const locator = new FakeLocator();
    locator.directories.set("/work/a", live("https://github.com/acme/tool"));
    locator.directories.set("/work/b", live(null));
    locator.directories.set("/work/c", { ...live(null), rootCommit: null });
    await migration(locator).execute();
    expect(await table()).toEqual({ version: 1, complete: true, aliases: {}, pending: [] });
  });

  it("leaves no roots.json where there was none", async () => {
    await migration(new FakeLocator()).execute();
    await expect(readFile(join(dir, "roots.json"), "utf8")).rejects.toThrow();
    expect(await table()).toEqual({ version: 1, complete: true, aliases: {}, pending: [] });
  });

  it("maps a root it could not read at its first run once it can, so the repository keeps one id", async () => {
    // Found by the independent check: the table was marked complete with the root unmapped.
    await rooted("/work/a");
    await writeFile(join(dir, "2026-10-07.jsonl"), `${JSON.stringify(call())}\n`);
    const locator = new FakeLocator();
    locator.directories.set("/work/a", { status: "unreadable" });
    await migration(locator).execute();
    expect(await table()).toEqual({
      version: 1,
      complete: true,
      aliases: {},
      pending: ["/work/a"],
    });
    locator.directories.set("/work/a", live(MIXED.remote));
    await migration(locator).execute();
    expect(await table()).toEqual({
      version: 1,
      complete: true,
      aliases: { [OLD]: NEW },
      pending: [],
    });
    expect(await readFile(join(dir, "2026-10-07.jsonl"), "utf8")).toBe(
      `${JSON.stringify(call({ key: "msg_A:s-1", repository_id: NEW }))}\n`
    );
    expect(await readFile(join(dir, "roots.json"), "utf8")).not.toContain(OLD);
  });

  it("stopped at any write of a pending root's retry and run again, ends as a retry never stopped", async () => {
    const files = async () =>
      Promise.all(
        ["2026-10-07.jsonl", "roots.json", "repository-ids.json"].map((name) =>
          readFile(join(dir, name), "utf8")
        )
      );
    const firstRun = async () => {
      await rooted("/work/a");
      await writeFile(join(dir, "2026-10-07.jsonl"), `${JSON.stringify(call())}\n`);
      await rm(join(dir, "repository-ids.json"), { force: true });
      const locator = new FakeLocator();
      locator.directories.set("/work/a", { status: "unreadable" });
      await migration(locator).execute();
      locator.directories.set("/work/a", live(MIXED.remote));
      return locator;
    };
    await migration(await firstRun()).execute();
    const clean = await files();
    for (let failAt = 1; ; failAt += 1) {
      const locator = await firstRun();
      const stopped = await migration(locator, new FailingStorage(failAt))
        .execute()
        .then(
          () => false,
          () => true
        );
      await migration(locator).execute();
      expect(await files()).toEqual(clean);
      if (!stopped) break;
    }
  });

  it("keeps a root gone at its first run pending, and drops one that is no repository now", async () => {
    await rooted("/work/a", "/work/b");
    const locator = new FakeLocator();
    locator.directories.set("/work/b", { status: "outside-repository" });
    await migration(locator).execute();
    expect((await table()).pending).toEqual(["/work/a"]);
    locator.directories.set("/work/a", { status: "outside-repository" });
    await migration(locator).execute();
    expect(await table()).toEqual({ version: 1, complete: true, aliases: {}, pending: [] });
  });

  it("asks only the pending roots again, and writes nothing while none can be read", async () => {
    await rooted("/work/a", "/work/b");
    const locator = new FakeLocator();
    locator.directories.set("/work/a", { status: "unreadable" });
    locator.directories.set("/work/b", live("https://github.com/acme/tool"));
    await migration(locator).execute();
    const before = await table();
    locator.asked.length = 0;
    await migration(locator, new FailingStorage(1)).execute();
    expect(locator.asked).toEqual(["/work/a"]);
    expect(await table()).toEqual(before);
  });

  it("asks git nothing and rewrites nothing once complete", async () => {
    await rooted("/work/a");
    await writeAliases(true);
    const earlier = `${JSON.stringify(call())}\n`;
    await writeFile(join(dir, "2026-10-07.jsonl"), earlier);
    const roots = await readFile(join(dir, "roots.json"), "utf8");
    const locator = new FakeLocator();
    await migration(locator).execute();
    expect(locator.asked).toEqual([]);
    expect(await readFile(join(dir, "2026-10-07.jsonl"), "utf8")).toBe(earlier);
    expect(await readFile(join(dir, "roots.json"), "utf8")).toBe(roots);
  });

  it("finishes an unfinished one with its own table, asking git nothing", async () => {
    await rooted("/work/a");
    await writeAliases(false);
    await writeFile(join(dir, "2026-10-07.jsonl"), `${JSON.stringify(call())}\n`);
    const locator = new FakeLocator();
    await migration(locator).execute();
    expect(locator.asked).toEqual([]);
    expect(await table()).toMatchObject({ complete: true, aliases: { [OLD]: NEW } });
    expect(await readFile(join(dir, "2026-10-07.jsonl"), "utf8")).toContain(NEW);
  });

  it("writes its table before anything else, and says it is complete last", async () => {
    await rooted("/work/a");
    await writeFile(join(dir, "2026-10-07.jsonl"), `${JSON.stringify(call())}\n`);
    const locator = new FakeLocator();
    locator.directories.set("/work/a", live(MIXED.remote));
    await expect(migration(locator, new FailingStorage(2)).execute()).rejects.toThrow();
    expect(await table()).toEqual({
      version: 1,
      complete: false,
      aliases: { [OLD]: NEW },
      pending: [],
    });
    // Rerun: roots.json, the day, then the table marked complete, which fails.
    await expect(migration(new FakeLocator(), new FailingStorage(3)).execute()).rejects.toThrow();
    expect(await readFile(join(dir, "2026-10-07.jsonl"), "utf8")).toContain(NEW);
    expect((await table()).complete).toBe(false);
  });
});
