import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { StoredUsage } from "../../../../src/contexts/telemetry/domain/stored-usage.js";
import { UsageLedgerAdapter } from "../../../../src/contexts/telemetry/infrastructure/usage-ledger-adapter.js";
import { PrivateStorageAdapter } from "../../../../src/runtime/filesystem/private-storage-adapter.js";

let root: string;
let dir: string;
let ledger: UsageLedgerAdapter;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-usage-ledger-"));
  dir = join(root, "ledger");
  ledger = new UsageLedgerAdapter(dir, new PrivateStorageAdapter());
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function stored(overrides: Partial<StoredUsage> = {}): StoredUsage {
  return {
    tool: "claude-code",
    tool_version: "2.1.0",
    key: "msg_A:req_A",
    session_id: "s-1",
    agent: "main",
    at: "2026-10-07T10:00:00.000Z",
    model: "m",
    input: 1,
    output: 10,
    cache_read: 0,
    cache_write: 0,
    cache_write_1h: null,
    reasoning: null,
    cwd: null,
    git_branch: null,
    repository_id: "repo-1",
    ...overrides,
  };
}

const partitions = async (): Promise<string[]> =>
  (await readdir(dir)).filter((name) => /^\d{4}-\d{2}\.jsonl$/.test(name)).sort();

describe("the ledger on disk", () => {
  it("holds nothing before anything is saved", async () => {
    expect(await ledger.load()).toEqual({
      records: [],
      skippedLines: 0,
      damagedMonths: new Set(),
    });
  });

  it("round-trips what is saved", async () => {
    const records = [stored(), stored({ key: "msg_B:req_B", input: null })];
    await ledger.save(records);
    expect((await ledger.load()).records).toEqual(records);
  });

  it("files each record under the month of its own time, in UTC", async () => {
    await ledger.save([
      stored({ key: "a", at: "2026-10-31T23:30:00-05:00" }),
      stored({ key: "b", at: "2026-10-15T00:00:00Z" }),
      stored({ key: "c", at: "2026-12-01T00:00:00Z" }),
    ]);
    expect(await partitions()).toEqual(["2026-10.jsonl", "2026-11.jsonl", "2026-12.jsonl"]);
    expect(await readFile(join(dir, "2026-11.jsonl"), "utf8")).toContain('"key":"a"');
  });

  it("writes one record per line, ending in a newline", async () => {
    await ledger.save([stored({ key: "a" }), stored({ key: "b" })]);
    const text = await readFile(join(dir, "2026-10.jsonl"), "utf8");
    expect(text.endsWith("\n")).toBe(true);
    expect(text.trimEnd().split("\n")).toHaveLength(2);
  });

  it("writes the same bytes whatever order the records come in", async () => {
    const a = stored({ key: "a", at: "2026-10-01T00:00:00Z" });
    const b = stored({ key: "b", at: "2026-10-02T00:00:00Z" });
    const c = stored({ key: "c", at: "2026-10-03T00:00:00Z" });
    await ledger.save([c, a, b]);
    const first = await readFile(join(dir, "2026-10.jsonl"), "utf8");
    await rm(dir, { recursive: true });
    await ledger.save([b, c, a]);
    expect(await readFile(join(dir, "2026-10.jsonl"), "utf8")).toBe(first);
  });

  it("does not touch a partition that already holds what it should", async () => {
    await ledger.save([stored({ key: "a" }), stored({ key: "z", at: "2026-11-02T00:00:00Z" })]);
    const octoberBefore = await stat(join(dir, "2026-10.jsonl"));
    const novemberBefore = await stat(join(dir, "2026-11.jsonl"));
    await ledger.save([
      stored({ key: "a" }),
      stored({ key: "z", at: "2026-11-02T00:00:00Z", output: 99 }),
    ]);
    expect((await stat(join(dir, "2026-10.jsonl"))).ino).toBe(octoberBefore.ino);
    expect((await stat(join(dir, "2026-11.jsonl"))).ino).not.toBe(novemberBefore.ino);
  });

  it("rewrites only the months it is told changed, and reads no other partition", async () => {
    await ledger.save([
      stored({ key: "a", at: "2026-08-02T00:00:00Z" }),
      stored({ key: "b", at: "2026-09-02T00:00:00Z" }),
    ]);
    const septemberBefore = await stat(join(dir, "2026-09.jsonl"));
    await writeFile(join(dir, "2026-08.jsonl"), "{not a record}\n");
    await ledger.save(
      [
        stored({ key: "a", at: "2026-08-02T00:00:00Z" }),
        stored({ key: "b", at: "2026-09-02T00:00:00Z", output: 99 }),
        stored({ key: "c", at: "2026-10-02T00:00:00Z" }),
      ],
      new Set(["2026-09", "2026-10"])
    );
    expect(await readFile(join(dir, "2026-08.jsonl"), "utf8")).toBe("{not a record}\n");
    expect((await stat(join(dir, "2026-09.jsonl"))).ino).not.toBe(septemberBefore.ino);
    expect(await readFile(join(dir, "2026-09.jsonl"), "utf8")).toContain('"output":99');
    expect(await partitions()).toEqual(["2026-08.jsonl", "2026-09.jsonl", "2026-10.jsonl"]);
  });

  it("removes a told month that no longer holds anything", async () => {
    await ledger.save([stored({ key: "a", at: "2026-08-02T00:00:00Z" })]);
    await ledger.save(
      [stored({ key: "a", at: "2026-09-02T00:00:00Z", output: 2 })],
      new Set(["2026-08", "2026-09"])
    );
    expect(await partitions()).toEqual(["2026-09.jsonl"]);
  });

  it("leaves one live record when a better snapshot moves a call to another month", async () => {
    await ledger.save([stored({ output: 10, at: "2026-10-31T23:59:59.000Z" })]);
    await ledger.save([stored({ output: 90, at: "2026-11-01T00:00:01.000Z" })]);
    expect(await partitions()).toEqual(["2026-11.jsonl"]);
    const { records } = await ledger.load();
    expect(records.map((r) => r.output)).toEqual([90]);
  });

  it("reads only month files, and leaves the offsets and lock beside them alone", async () => {
    await ledger.savePositions(new Map([["/t", { offset: 1, size: 1, identity: "i" }]]));
    await writeFile(join(dir, "x2026-10.jsonl"), "garbage\n");
    await writeFile(join(dir, "2026-10.jsonl.bak"), "garbage\n");
    await writeFile(join(dir, "26-10.jsonl"), "garbage\n");
    expect(await ledger.load()).toEqual({
      records: [],
      skippedLines: 0,
      damagedMonths: new Set(),
    });
    await ledger.save([stored()]);
    expect((await ledger.positions()).size).toBe(1);
    expect((await readdir(dir)).sort()).toEqual([
      "2026-10.jsonl",
      "2026-10.jsonl.bak",
      "26-10.jsonl",
      "offsets.json",
      "x2026-10.jsonl",
    ]);
  });

  it("fails to load from a ledger directory it cannot list, instead of reading it as empty", async () => {
    const file = join(root, "not-a-directory");
    await writeFile(file, "x");
    await expect(
      new UsageLedgerAdapter(file, new PrivateStorageAdapter()).load()
    ).rejects.toThrow();
  });

  it("folds a call found in two partitions down to its best snapshot", async () => {
    await ledger.save([]);
    await writeFile(join(dir, "2026-10.jsonl"), `${JSON.stringify(stored({ output: 10 }))}\n`);
    await writeFile(
      join(dir, "2026-11.jsonl"),
      `${JSON.stringify(stored({ output: 90, at: "2026-11-01T00:00:00Z" }))}\n`
    );
    expect((await ledger.load()).records.map((r) => r.output)).toEqual([90]);
  });

  it("counts a line that is not a record and drops it at the next save", async () => {
    await ledger.save([stored()]);
    const path = join(dir, "2026-10.jsonl");
    await writeFile(path, `${await readFile(path, "utf8")}{torn\n\n`);
    const loaded = await ledger.load();
    expect(loaded.skippedLines).toBe(1);
    expect([...loaded.damagedMonths]).toEqual(["2026-10"]);
    expect(loaded.records).toHaveLength(1);
    await ledger.save([...loaded.records, stored({ key: "b" })]);
    expect(await readFile(path, "utf8")).not.toContain("torn");
  });

  it("names only the months that hold a line that is not a record", async () => {
    await ledger.save([stored(), stored({ key: "n", at: "2026-11-02T00:00:00Z" })]);
    await writeFile(join(dir, "2026-10.jsonl"), "{torn\n");
    const loaded = await ledger.load();
    expect([...loaded.damagedMonths]).toEqual(["2026-10"]);
    await ledger.save(loaded.records, loaded.damagedMonths);
    expect((await ledger.load()).skippedLines).toBe(0);
  });

  it.skipIf(process.platform === "win32")(
    "keeps its files readable by their owner alone",
    async () => {
      await ledger.save([stored()]);
      await ledger.savePositions(new Map([["/t", { offset: 1, size: 1, identity: "i" }]]));
      expect((await stat(dir)).mode & 0o777).toBe(0o700);
      expect((await stat(join(dir, "2026-10.jsonl"))).mode & 0o777).toBe(0o600);
      expect((await stat(join(dir, "offsets.json"))).mode & 0o777).toBe(0o600);
    }
  );
});

describe("the positions of the transcripts read", () => {
  it("round-trip", async () => {
    const positions = new Map([
      ["/b.jsonl", { offset: 5, size: 9, identity: "1:2" }],
      ["/a.jsonl", { offset: 0, size: 0, identity: "1:3" }],
    ]);
    await ledger.savePositions(positions);
    expect(await ledger.positions()).toEqual(positions);
  });

  it("are empty before any read", async () => {
    expect((await ledger.positions()).size).toBe(0);
  });

  it("are empty when the file is unreadable, so every transcript is read whole", async () => {
    await ledger.save([]);
    await writeFile(join(dir, "offsets.json"), "{broken");
    expect((await ledger.positions()).size).toBe(0);
  });

  it("drop an entry that is not a position", async () => {
    await ledger.save([]);
    await writeFile(
      join(dir, "offsets.json"),
      JSON.stringify({
        "/ok": { offset: 1, size: 2, identity: "i" },
        "/negative": { offset: -1, size: 2, identity: "i" },
        "/fraction": { offset: 1.5, size: 2, identity: "i" },
        "/no-size": { offset: 1, identity: "i" },
        "/no-identity": { offset: 1, size: 2 },
        "/text": "x",
      })
    );
    expect([...(await ledger.positions()).keys()]).toEqual(["/ok"]);
  });
});

describe("writing under the lock", () => {
  it("lets one writer at a time in", async () => {
    const events: string[] = [];
    const work = (name: string) => async () => {
      events.push(`${name}:in`);
      await new Promise((done) => setTimeout(done, 40));
      events.push(`${name}:out`);
    };
    await Promise.all([ledger.exclusively(work("a")), ledger.exclusively(work("b"))]);
    expect(events).toHaveLength(4);
    expect(events[1]).toMatch(/:out$/);
    expect(events[0]?.slice(0, 1)).toBe(events[1]?.slice(0, 1));
  });

  it("returns what the work returns and releases the lock", async () => {
    expect(await ledger.exclusively(async () => 7)).toBe(7);
    expect(await readdir(dir)).not.toContain(".lock");
  });

  it("releases the lock when the work throws", async () => {
    await expect(
      ledger.exclusively(async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    expect(await readdir(dir)).not.toContain(".lock");
  });
});
