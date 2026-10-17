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

const PARTITION_NAME = /^\d{4}-\d{2}-\d{2}\.jsonl$/;

const partitions = async (): Promise<string[]> =>
  (await readdir(dir)).filter((name) => PARTITION_NAME.test(name)).sort();

/** A partition as an earlier version wrote it, records given in their canonical order. */
const lines = (records: readonly StoredUsage[]): string =>
  `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;

async function writePartition(name: string, content: string): Promise<void> {
  await new PrivateStorageAdapter().ensureDirectory(dir);
  await writeFile(join(dir, name), content);
}

/** A window holding exactly these days. */
const only =
  (...days: string[]) =>
  (day: string): boolean =>
    days.includes(day);

const NOTHING = { records: [], skippedLines: 0, damaged: new Set(), unsettled: new Set() };

describe("the ledger on disk", () => {
  it("holds nothing before anything is saved", async () => {
    expect(await ledger.load()).toEqual(NOTHING);
  });

  it("round-trips what is saved", async () => {
    const records = [stored(), stored({ key: "msg_B:req_B", input: null })];
    await ledger.save(records);
    expect((await ledger.load()).records).toEqual(records);
  });

  it("files each record under the day of its own time, in UTC", async () => {
    await ledger.save([
      stored({ key: "a", at: "2026-10-31T23:30:00-05:00" }),
      stored({ key: "b", at: "2026-10-15T00:00:00Z" }),
      stored({ key: "c", at: "2026-12-01T00:00:00Z" }),
    ]);
    expect(await partitions()).toEqual([
      "2026-10-15.jsonl",
      "2026-11-01.jsonl",
      "2026-12-01.jsonl",
    ]);
    expect(await readFile(join(dir, "2026-11-01.jsonl"), "utf8")).toContain('"key":"a"');
  });

  it("writes one record per line, ending in a newline", async () => {
    await ledger.save([stored({ key: "a" }), stored({ key: "b" })]);
    const text = await readFile(join(dir, "2026-10-07.jsonl"), "utf8");
    expect(text.endsWith("\n")).toBe(true);
    expect(text.trimEnd().split("\n")).toHaveLength(2);
  });

  it("writes the same bytes whatever order the records come in", async () => {
    const a = stored({ key: "a", at: "2026-10-07T01:00:00Z" });
    const b = stored({ key: "b", at: "2026-10-07T02:00:00Z" });
    const c = stored({ key: "c", at: "2026-10-07T03:00:00Z" });
    await ledger.save([c, a, b]);
    const first = await readFile(join(dir, "2026-10-07.jsonl"), "utf8");
    await rm(dir, { recursive: true });
    await ledger.save([b, c, a]);
    expect(await readFile(join(dir, "2026-10-07.jsonl"), "utf8")).toBe(first);
  });

  it("does not touch a partition that already holds what it should", async () => {
    await ledger.save([stored({ key: "a" }), stored({ key: "z", at: "2026-11-02T00:00:00Z" })]);
    const octoberBefore = await stat(join(dir, "2026-10-07.jsonl"));
    const novemberBefore = await stat(join(dir, "2026-11-02.jsonl"));
    await ledger.save([
      stored({ key: "a" }),
      stored({ key: "z", at: "2026-11-02T00:00:00Z", output: 99 }),
    ]);
    expect((await stat(join(dir, "2026-10-07.jsonl"))).ino).toBe(octoberBefore.ino);
    expect((await stat(join(dir, "2026-11-02.jsonl"))).ino).not.toBe(novemberBefore.ino);
  });

  it("rewrites only the days it is told changed, and reads no other partition", async () => {
    await ledger.save([
      stored({ key: "a", at: "2026-08-02T00:00:00Z" }),
      stored({ key: "b", at: "2026-09-02T00:00:00Z" }),
    ]);
    const septemberBefore = await stat(join(dir, "2026-09-02.jsonl"));
    await writeFile(join(dir, "2026-08-02.jsonl"), "{not a record}\n");
    await ledger.save(
      [
        stored({ key: "a", at: "2026-08-02T00:00:00Z" }),
        stored({ key: "b", at: "2026-09-02T00:00:00Z", output: 99 }),
        stored({ key: "c", at: "2026-10-02T00:00:00Z" }),
      ],
      new Set(["2026-09-02", "2026-10-02"])
    );
    expect(await readFile(join(dir, "2026-08-02.jsonl"), "utf8")).toBe("{not a record}\n");
    expect((await stat(join(dir, "2026-09-02.jsonl"))).ino).not.toBe(septemberBefore.ino);
    expect(await readFile(join(dir, "2026-09-02.jsonl"), "utf8")).toContain('"output":99');
    expect(await partitions()).toEqual([
      "2026-08-02.jsonl",
      "2026-09-02.jsonl",
      "2026-10-02.jsonl",
    ]);
  });

  it("removes a told day that no longer holds anything", async () => {
    await ledger.save([stored({ key: "a", at: "2026-08-02T00:00:00Z" })]);
    await ledger.save(
      [stored({ key: "a", at: "2026-08-03T00:00:00Z", output: 2 })],
      new Set(["2026-08-02", "2026-08-03"])
    );
    expect(await partitions()).toEqual(["2026-08-03.jsonl"]);
  });

  it("leaves one live record when a better snapshot moves a call to another day", async () => {
    await ledger.save([stored({ output: 10, at: "2026-10-31T23:59:59.000Z" })]);
    await ledger.save([stored({ output: 90, at: "2026-11-01T00:00:01.000Z" })]);
    expect(await partitions()).toEqual(["2026-11-01.jsonl"]);
    const { records } = await ledger.load();
    expect(records.map((r) => r.output)).toEqual([90]);
  });

  it("reads only day files, and leaves a month's name, the offsets, roots, consents and lock alone", async () => {
    await ledger.savePositions(new Map([["/t", { offset: 1, size: 1, identity: "i" }]]));
    const beside = [
      "x2026-10-07.jsonl",
      "2026-10.jsonl",
      "x2026-10.jsonl",
      "2026-10-07.jsonl.bak",
      "26-10-07.jsonl",
      "2026-10-7.jsonl",
      "2026-10.jsonl.bak",
      "consents.jsonl",
      "roots.json",
      ".lock",
    ];
    for (const name of beside) await writeFile(join(dir, name), "garbage\n");
    expect(await ledger.load()).toEqual(NOTHING);
    await ledger.save([stored()]);
    expect((await ledger.positions()).size).toBe(1);
    expect((await readdir(dir)).sort()).toEqual(
      [...beside, "2026-10-07.jsonl", "offsets.json"].sort()
    );
  });

  it("fails to load from a ledger directory it cannot list, instead of reading it as empty", async () => {
    const file = join(root, "not-a-directory");
    await writeFile(file, "x");
    await expect(
      new UsageLedgerAdapter(file, new PrivateStorageAdapter()).load()
    ).rejects.toThrow();
  });

  it("folds a call found in two days down to its best snapshot, and says both are unsettled", async () => {
    await writePartition(
      "2026-10-31.jsonl",
      lines([stored({ output: 10, at: "2026-10-31T23:59:00Z" })])
    );
    await writePartition(
      "2026-11-01.jsonl",
      lines([stored({ output: 90, at: "2026-11-01T00:00:00Z" })])
    );
    await writePartition(
      "2026-11-02.jsonl",
      lines([stored({ key: "other", at: "2026-11-02T00:00:00Z" })])
    );
    const loaded = await ledger.load();
    expect(loaded.records.map((r) => r.output)).toEqual([90, 10]);
    expect([...loaded.unsettled].sort()).toEqual(["2026-10-31", "2026-11-01"]);
  });

  it("says a day holding one call twice is unsettled, and settles it to one line", async () => {
    await writePartition("2026-10-07.jsonl", lines([stored({ output: 1 }), stored({ output: 9 })]));
    const loaded = await ledger.load();
    expect([...loaded.unsettled]).toEqual(["2026-10-07"]);
    await ledger.save(loaded.records, loaded.unsettled);
    expect(await readFile(join(dir, "2026-10-07.jsonl"), "utf8")).toBe(
      lines([stored({ output: 9 })])
    );
  });

  it("counts a line that is not a record, and keeps it at every save, after the records", async () => {
    await ledger.save([stored()]);
    const path = join(dir, "2026-10-07.jsonl");
    await writeFile(path, `{torn\n${await readFile(path, "utf8")}\n`);
    const loaded = await ledger.load();
    expect(loaded.skippedLines).toBe(1);
    expect([...loaded.damaged]).toEqual(["2026-10-07"]);
    expect(loaded.records).toHaveLength(1);
    await ledger.save([...loaded.records, stored({ key: "b" })]);
    expect(await readFile(path, "utf8")).toBe(`${lines([stored({ key: "b" }), stored()])}{torn\n`);
    expect((await ledger.load()).skippedLines).toBe(1);
  });

  it("names only the partitions that hold a line that is not a record, and still does once saved", async () => {
    await ledger.save([stored(), stored({ key: "n", at: "2026-11-02T00:00:00Z" })]);
    await writeFile(join(dir, "2026-10-07.jsonl"), "{torn\n");
    const loaded = await ledger.load();
    expect([...loaded.damaged]).toEqual(["2026-10-07"]);
    expect(loaded.unsettled.size).toBe(0);
    await ledger.save(loaded.records, loaded.damaged);
    const again = await ledger.load();
    expect([again.skippedLines, [...again.damaged]]).toEqual([1, ["2026-10-07"]]);
  });

  it("keeps a newer version's record it cannot read, byte for byte, through every rewrite", async () => {
    const newer = JSON.stringify({ ...stored({ key: "r" }), agent: "reviewer", effort: "high" });
    await writePartition("2026-10-07.jsonl", `${newer}\n${lines([stored()])}`);
    await ledger.save([stored({ output: 99 }), stored({ key: "b" })]);
    await ledger.save([stored({ output: 99 })], new Set(["2026-10-07"]));
    expect(await readFile(join(dir, "2026-10-07.jsonl"), "utf8")).toBe(
      `${lines([stored({ output: 99 })])}${newer}\n`
    );
  });

  it("keeps a day that holds only lines that are not records, when its calls move away", async () => {
    await writePartition(
      "2026-08-02.jsonl",
      `${lines([stored({ key: "a", at: "2026-08-02T00:00:00Z" })])}{torn\n`
    );
    await ledger.save(
      [stored({ key: "a", at: "2026-08-03T00:00:00Z", output: 2 })],
      new Set(["2026-08-02", "2026-08-03"])
    );
    expect(await readFile(join(dir, "2026-08-02.jsonl"), "utf8")).toBe("{torn\n");
    await ledger.save([]);
    expect(await partitions()).toEqual(["2026-08-02.jsonl"]);
  });

  it("writes the lines it keeps in text order, each once, whatever order they were found in", async () => {
    await writePartition("2026-10-07.jsonl", `{z\n${lines([stored()])}{a\n{z\n`);
    await ledger.save([stored()]);
    expect(await readFile(join(dir, "2026-10-07.jsonl"), "utf8")).toBe(
      `${lines([stored()])}{a\n{z\n`
    );
  });

  it.skipIf(process.platform === "win32")(
    "keeps its files readable by their owner alone",
    async () => {
      await ledger.save([stored()]);
      await ledger.savePositions(new Map([["/t", { offset: 1, size: 1, identity: "i" }]]));
      expect((await stat(dir)).mode & 0o777).toBe(0o700);
      expect((await stat(join(dir, "2026-10-07.jsonl"))).mode & 0o777).toBe(0o600);
      expect((await stat(join(dir, "offsets.json"))).mode & 0o777).toBe(0o600);
    }
  );
});

describe("reading a window of days", () => {
  it("reads only the days it is given, and opens no other partition", async () => {
    await ledger.save([
      stored({ key: "a", at: "2026-10-06T10:00:00Z" }),
      stored({ key: "b", at: "2026-10-07T10:00:00Z" }),
      stored({ key: "c", at: "2026-10-08T10:00:00Z" }),
    ]);
    await writeFile(join(dir, "2026-10-06.jsonl"), "{torn\n");
    expect(await ledger.load(only("2026-10-07"))).toEqual({
      ...NOTHING,
      records: [stored({ key: "b", at: "2026-10-07T10:00:00Z" })],
    });
  });

  it("reads only the days of a closed window, and no partition outside it", async () => {
    await ledger.save(
      ["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"].map((day) =>
        stored({ key: day, at: `${day}T10:00:00Z` })
      )
    );
    await writeFile(join(dir, "2026-10-04.jsonl"), "{torn\n");
    await writeFile(join(dir, "2026-10-08.jsonl"), "{torn\n");
    const loaded = await ledger.load((day) => day >= "2026-10-05" && day <= "2026-10-07");
    expect(loaded.records.map((r) => r.key)).toEqual(["2026-10-05", "2026-10-06", "2026-10-07"]);
    expect(loaded.skippedLines).toBe(0);
  });

  it("reads every day from a date on, and none before it, for a window open on one side", async () => {
    const days = ["2025-12-31", "2026-01-01", "2026-06-15", "2031-03-02"];
    await ledger.save(days.map((day) => stored({ key: day, at: `${day}T10:00:00Z` })));
    await writeFile(join(dir, "2025-12-31.jsonl"), "{torn\n");
    const loaded = await ledger.load((day) => day >= "2026-01-01");
    expect(loaded.records.map((r) => r.key)).toEqual(["2026-01-01", "2026-06-15", "2031-03-02"]);
    expect(loaded.skippedLines).toBe(0);
  });

  it("reads nothing for an empty window", async () => {
    await ledger.save([stored()]);
    expect(await ledger.load(() => false)).toEqual(NOTHING);
  });

  it("finds a call held in two days of its window", async () => {
    await writePartition(
      "2026-10-06.jsonl",
      lines([stored({ output: 1, at: "2026-10-06T23:59:00Z" })])
    );
    await writePartition("2026-10-07.jsonl", lines([stored({ output: 9 })]));
    const loaded = await ledger.load(only("2026-10-06", "2026-10-07", "2026-10-08"));
    expect(loaded.records.map((r) => r.output)).toEqual([9]);
    expect([...loaded.unsettled].sort()).toEqual(["2026-10-06", "2026-10-07"]);
  });
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

describe("what was measured and left out, beside the ledger", () => {
  const FILE = () => join(dir, "left-out.txt");

  it("holds nothing before anything is kept, and creates nothing", async () => {
    expect(await ledger.leftOut.counts()).toEqual({ undated: 0, unrecognised: 0 });
    await expect(readdir(root)).resolves.toEqual([]);
  });

  it("keeps each thing once, by a hash, in text order, and never its text", async () => {
    await ledger.leftOut.add([
      { reason: "unrecognised", of: "{secret prompt" },
      { reason: "undated", of: "claude-code\u0000msg_A:req_A" },
      { reason: "unrecognised", of: "{secret prompt" },
    ]);
    const first = await readFile(FILE(), "utf8");
    await ledger.leftOut.add([{ reason: "undated", of: "claude-code\u0000msg_A:req_A" }]);
    const text = await readFile(FILE(), "utf8");
    expect(text).toBe(first);
    expect(text).not.toContain("secret");
    expect(text).not.toContain("msg_A");
    const found = text.split("\n").slice(0, -1);
    expect(found).toHaveLength(2);
    expect(found).toEqual([...found].sort());
    for (const entry of found) expect(entry).toMatch(/^(undated|unrecognised) [0-9a-f]{32}$/);
    expect(await ledger.leftOut.counts()).toEqual({ undated: 1, unrecognised: 1 });
  });

  it("tells two things of one reason apart by what they are", async () => {
    await ledger.leftOut.add([
      { reason: "undated", of: "claude-code\u0000a" },
      { reason: "undated", of: "claude-code\u0000b" },
    ]);
    expect(await ledger.leftOut.counts()).toEqual({ undated: 2, unrecognised: 0 });
  });

  it("names a thing by its reason and what it is, so two reasons of one text are two", async () => {
    await ledger.leftOut.add([
      { reason: "undated", of: "x" },
      { reason: "unrecognised", of: "x" },
    ]);
    expect(await ledger.leftOut.counts()).toEqual({ undated: 1, unrecognised: 1 });
  });

  it("keeps a line it does not know, and counts only its own", async () => {
    await new PrivateStorageAdapter().ensureDirectory(dir);
    await writeFile(FILE(), "zz-later 0123\nconstructor 1\n");
    await ledger.leftOut.add([{ reason: "undated", of: "k" }]);
    const text = await readFile(FILE(), "utf8");
    expect(text).toContain("zz-later 0123\n");
    expect(text).toContain("constructor 1\n");
    expect(await ledger.leftOut.counts()).toEqual({ undated: 1, unrecognised: 0 });
  });

  it("writes nothing when nothing new is added", async () => {
    await ledger.leftOut.add([{ reason: "undated", of: "k" }]);
    const before = await stat(FILE());
    await ledger.leftOut.add([{ reason: "undated", of: "k" }]);
    expect((await stat(FILE())).ino).toBe(before.ino);
  });

  it("is no partition: the ledger neither loads it nor removes it", async () => {
    await ledger.leftOut.add([{ reason: "undated", of: "k" }]);
    await ledger.save([stored()]);
    expect((await ledger.load()).skippedLines).toBe(0);
    expect(await readdir(dir)).toContain("left-out.txt");
  });
});
