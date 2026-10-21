import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  settleLedger,
  storeCalls,
} from "../../../../src/contexts/telemetry/application/ledger-upkeep.js";
import {
  partitionByDay,
  type StoredUsage,
} from "../../../../src/contexts/telemetry/domain/stored-usage.js";
import { UsageLedgerAdapter } from "../../../../src/contexts/telemetry/infrastructure/usage-ledger-adapter.js";
import { PrivateStorageAdapter } from "../../../../src/runtime/filesystem/private-storage-adapter.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-ledger-upkeep-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function stored(key: string, at: string, output: number): StoredUsage {
  return {
    tool: "claude-code",
    tool_version: "2.1.0",
    key,
    session_id: "s-1",
    agent: "main",
    at,
    model: "m",
    input: 1,
    output,
    cache_read: 0,
    cache_write: 0,
    cache_write_1h: null,
    reasoning: null,
    cwd: null,
    git_branch: null,
    repository_id: "repo-1",
  };
}

const CALLS = [
  stored("a", "2026-09-01T08:00:00.000Z", 10),
  stored("b", "2026-09-15T12:00:00.000Z", 20),
  stored("c", "2026-09-30T23:59:00.000Z", 30),
  stored("d", "2026-10-01T00:01:00.000Z", 40),
  stored("e", "2026-10-20T10:00:00.000Z", 50),
];

/** Each day's canonical lines, as a fresh ledger writes them. */
function daysOf(records: readonly StoredUsage[]): Map<string, string> {
  const days = new Map<string, string>();
  for (const [day, inDay] of partitionByDay(records)) {
    days.set(`${day}.jsonl`, `${inDay.map((record) => JSON.stringify(record)).join("\n")}\n`);
  }
  return days;
}

async function ledgerAt(name: string, files: ReadonlyMap<string, string>) {
  const dir = join(root, name);
  await mkdir(dir, { recursive: true });
  for (const [file, text] of files) await writeFile(join(dir, file), text);
  return { dir, ledger: new UsageLedgerAdapter(dir, new PrivateStorageAdapter()) };
}

async function bytes(dir: string): Promise<Record<string, string>> {
  const found: Record<string, string> = {};
  for (const name of (await readdir(dir)).sort()) {
    if (/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name)) {
      found[name] = await readFile(join(dir, name), "utf8");
    }
  }
  return found;
}

const days = () => daysOf(CALLS);

describe("settling a ledger", () => {
  it("settles nothing, and writes nothing, on a ledger already in days", async () => {
    const { dir, ledger } = await ledgerAt("settled", days());
    const before = await bytes(dir);
    await writeFile(join(dir, "2026-09-01.jsonl.bak"), "untouched\n");
    expect((await settleLedger(ledger)).unsettled.size).toBe(0);
    expect(await bytes(dir)).toEqual(before);
  });

  it("keeps a line that is not a record, after its day's calls, and still counts it once settled", async () => {
    const damaged = new Map(days());
    damaged.set("2026-09-15.jsonl", `{torn\n${damaged.get("2026-09-15.jsonl")}`);
    const { dir, ledger } = await ledgerAt("damaged", damaged);
    expect((await settleLedger(ledger)).skippedLines).toBe(1);
    const settled = Object.fromEntries([...days()].sort());
    settled["2026-09-15.jsonl"] = `${settled["2026-09-15.jsonl"]}{torn\n`;
    expect(await bytes(dir)).toEqual(settled);
    expect((await settleLedger(ledger)).skippedLines).toBe(1);
    const result = await storeCalls(ledger, [stored("late", "2026-09-15T12:00:00.000Z", 1)]);
    expect(result.skippedLines).toBe(1);
    expect((await bytes(dir))["2026-09-15.jsonl"]).toMatch(/\{torn\n$/);
  });
});

describe("settling only a window", () => {
  /** Mid-September, so the window touches September and no day of October. */
  const window = (day: string): boolean => day >= "2026-09-14" && day <= "2026-09-16";

  it("neither reads nor repairs a damaged day outside the window", async () => {
    const damaged = new Map(days());
    const torn = `${damaged.get("2026-10-20.jsonl")}{torn\n`;
    damaged.set("2026-10-20.jsonl", torn);
    const { dir, ledger } = await ledgerAt("damaged-outside", damaged);
    const settled = await settleLedger(ledger, window);
    expect(settled.skippedLines).toBe(0);
    expect(settled.records.map((record) => record.key)).toEqual(["b"]);
    expect((await bytes(dir))["2026-10-20.jsonl"]).toBe(torn);
  });
});

describe("storing a call", () => {
  it("still reads only the days around a call with a request id", async () => {
    const ledger = new UsageLedgerAdapter(join(root, "ledger"), new PrivateStorageAdapter());
    await storeCalls(ledger, [stored("msg_1:req_1", "2026-10-01T10:00:00.000Z", 1)]);
    await storeCalls(ledger, [stored("msg_1:req_1", "2026-10-04T10:00:00.000Z", 2)]);
    expect((await readdir(join(root, "ledger"))).sort()).toEqual([
      "2026-10-01.jsonl",
      "2026-10-04.jsonl",
    ]);
  });
});
