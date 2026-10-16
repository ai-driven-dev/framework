import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { StoredUsage } from "../../../../src/contexts/telemetry/domain/stored-usage.js";
import { UsageLedgerAdapter } from "../../../../src/contexts/telemetry/infrastructure/usage-ledger-adapter.js";
import { PrivateStorageAdapter } from "../../../../src/runtime/filesystem/private-storage-adapter.js";
import { FailingStorage } from "../../../helpers/ports/failing-private-storage.js";

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

const PARTITION_NAME = /^\d{4}-\d{2}(-\d{2})?\.jsonl$/;

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

  it("reads only partition files, and leaves the offsets, roots, consents and lock beside them alone", async () => {
    await ledger.savePositions(new Map([["/t", { offset: 1, size: 1, identity: "i" }]]));
    const beside = [
      "x2026-10-07.jsonl",
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

  it("counts a line that is not a record and drops it at the next save", async () => {
    await ledger.save([stored()]);
    const path = join(dir, "2026-10-07.jsonl");
    await writeFile(path, `${await readFile(path, "utf8")}{torn\n\n`);
    const loaded = await ledger.load();
    expect(loaded.skippedLines).toBe(1);
    expect([...loaded.damaged]).toEqual(["2026-10-07"]);
    expect(loaded.records).toHaveLength(1);
    await ledger.save([...loaded.records, stored({ key: "b" })]);
    expect(await readFile(path, "utf8")).not.toContain("torn");
  });

  it("names only the partitions that hold a line that is not a record", async () => {
    await ledger.save([stored(), stored({ key: "n", at: "2026-11-02T00:00:00Z" })]);
    await writeFile(join(dir, "2026-10-07.jsonl"), "{torn\n");
    const loaded = await ledger.load();
    expect([...loaded.damaged]).toEqual(["2026-10-07"]);
    expect(loaded.unsettled.size).toBe(0);
    await ledger.save(loaded.records, loaded.damaged);
    expect((await ledger.load()).skippedLines).toBe(0);
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

  it("reads a monthly file the window touches by one day, with every day of its month", async () => {
    const early = stored({ key: "early", at: "2026-02-01T10:00:00Z" });
    const late = stored({ key: "late", at: "2026-02-27T10:00:00Z" });
    const daily = stored({ key: "daily", at: "2026-02-03T10:00:00Z" });
    await writePartition("2026-02.jsonl", lines([early, late]));
    await writePartition("2026-02-03.jsonl", lines([daily]));
    await writePartition(
      "2026-03-01.jsonl",
      lines([stored({ key: "march", at: "2026-03-01T10:00:00Z" })])
    );
    const loaded = await ledger.load((day) => day >= "2026-02-28" && day <= "2026-03-01");
    expect(loaded.records.map((r) => r.key)).toEqual(["daily", "early", "late", "march"]);
    expect([...loaded.unsettled]).toEqual(["2026-02"]);
  });

  it("does not read a monthly file the window touches on none of its days", async () => {
    await writePartition(
      "2026-02.jsonl",
      `${lines([stored({ at: "2026-02-28T10:00:00Z" })])}{torn\n`
    );
    await writePartition("2026-02-28.jsonl", "{torn\n");
    expect(await ledger.load((day) => day >= "2026-03-01")).toEqual(NOTHING);
    expect(await ledger.load((day) => day <= "2026-01-31")).toEqual(NOTHING);
  });

  it("passes over a monthly name no calendar holds, as it did before windows were tests", async () => {
    await ledger.save([stored()]);
    await writePartition("2026-13.jsonl", lines([stored({ key: "never" })]));
    expect((await ledger.load(only("2026-10-07"))).records).toEqual([stored()]);
  });

  it("reads nothing for an empty window", async () => {
    await ledger.save([stored()]);
    expect(await ledger.load(() => false)).toEqual(NOTHING);
  });

  it("reads a monthly partition, and the daily ones of its month, when a day of the window falls in it", async () => {
    const early = stored({ key: "early", at: "2026-09-10T10:00:00Z" });
    const late = stored({ key: "late", at: "2026-09-28T10:00:00Z" });
    const daily = stored({ key: "daily", at: "2026-09-25T10:00:00Z" });
    await writePartition("2026-09.jsonl", lines([early, late]));
    await writePartition("2026-09-25.jsonl", lines([daily]));
    for (const loaded of [await ledger.load(), await ledger.load(only("2026-09-10"))]) {
      expect(loaded.records.map((r) => r.key)).toEqual(["daily", "early", "late"]);
      expect([...loaded.unsettled]).toEqual(["2026-09"]);
    }
    expect(await ledger.load(only("2026-10-07"))).toEqual(NOTHING);
  });

  it("reads a monthly partition its window reaches by the day before", async () => {
    await writePartition("2026-09.jsonl", lines([stored({ at: "2026-09-30T10:00:00Z" })]));
    const loaded = await ledger.load(only("2026-09-30", "2026-10-01"));
    expect(loaded.records).toHaveLength(1);
    expect([...loaded.unsettled]).toEqual(["2026-09"]);
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

describe("splitting a monthly partition into its days", () => {
  const september = [
    stored({ key: "a", at: "2026-09-01T00:00:00Z" }),
    stored({ key: "b", at: "2026-09-15T12:00:00Z" }),
    stored({ key: "c", at: "2026-09-30T23:59:00Z" }),
  ];

  it("writes each day of the month, then removes the monthly file, in the bytes a fresh ledger has", async () => {
    await writePartition("2026-09.jsonl", lines(september));
    await writePartition(
      "2026-09-20.jsonl",
      lines([stored({ key: "gone", at: "2026-09-20T00:00:00Z" })])
    );
    await ledger.save(september, new Set(["2026-09"]));
    const fresh = new UsageLedgerAdapter(join(root, "fresh"), new PrivateStorageAdapter());
    await fresh.save(september);
    const names = ["2026-09-01.jsonl", "2026-09-15.jsonl", "2026-09-30.jsonl"];
    expect(await partitions()).toEqual(names);
    for (const name of names) {
      expect(await readFile(join(dir, name), "utf8")).toBe(
        await readFile(join(root, "fresh", name), "utf8")
      );
    }
  });

  it("writes only the days of the month it is told", async () => {
    await writePartition("2026-09.jsonl", lines(september));
    await ledger.save(
      [...september, stored({ key: "d", at: "2026-10-01T00:00:00Z" })],
      new Set(["2026-09"])
    );
    expect(await partitions()).not.toContain("2026-10-01.jsonl");
  });

  it("removes the monthly file only after its days are written", async () => {
    await writePartition("2026-09.jsonl", lines(september));
    const crashing = new UsageLedgerAdapter(dir, new FailingStorage(2));
    await expect(crashing.save(september, new Set(["2026-09"]))).rejects.toThrow("disk full");
    expect(await partitions()).toContain("2026-09.jsonl");
    const { records } = await ledger.load();
    expect(records.map((r) => r.key)).toEqual(["a", "b", "c"]);
  });

  it("removes every monthly file when told to hold exactly some records", async () => {
    await writePartition("2026-09.jsonl", lines(september));
    await ledger.save(september);
    expect(await partitions()).toEqual([
      "2026-09-01.jsonl",
      "2026-09-15.jsonl",
      "2026-09-30.jsonl",
    ]);
  });

  it("keeps the better snapshot a half-finished split already wrote, and finishes it", async () => {
    const worse = stored({ key: "a", output: 1, at: "2026-09-10T10:00:00Z" });
    const better = stored({ key: "a", output: 90, at: "2026-09-10T10:00:01Z" });
    const other = stored({ key: "b", at: "2026-09-20T10:00:00Z" });
    await writePartition("2026-09.jsonl", lines([worse, other]));
    await writePartition("2026-09-10.jsonl", lines([better]));
    const loaded = await ledger.load(only("2026-09-20"));
    expect(loaded.records).toEqual([better, other]);
    expect([...loaded.unsettled].sort()).toEqual(["2026-09", "2026-09-10"]);
    await ledger.save(loaded.records, loaded.unsettled);
    expect(await partitions()).toEqual(["2026-09-10.jsonl", "2026-09-20.jsonl"]);
    expect(await ledger.load()).toEqual({ ...NOTHING, records: [better, other] });
  });

  it("counts a line of a monthly file that is not a record, and drops it with the split", async () => {
    await writePartition("2026-09.jsonl", `${lines(september)}{torn\n`);
    const loaded = await ledger.load();
    expect(loaded.skippedLines).toBe(1);
    expect([...loaded.damaged]).toEqual(["2026-09"]);
    await ledger.save(loaded.records, new Set([...loaded.damaged, ...loaded.unsettled]));
    expect(await ledger.load()).toEqual({ ...NOTHING, records: september });
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
