import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  settleLedger,
  storeCalls,
} from "../../../../src/contexts/telemetry/application/ledger-upkeep.js";
import { buildReport } from "../../../../src/contexts/telemetry/domain/report/usage-report.js";
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

/** A month as an earlier version wrote it: its days' lines, in order, in one file. */
function monthsOf(records: readonly StoredUsage[]): Map<string, string> {
  const months = new Map<string, string>();
  for (const [name, text] of daysOf(records)) {
    const month = `${name.slice(0, 7)}.jsonl`;
    months.set(month, (months.get(month) ?? "") + text);
  }
  return months;
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
    if (/^\d{4}-\d{2}(-\d{2})?\.jsonl$/.test(name)) {
      found[name] = await readFile(join(dir, name), "utf8");
    }
  }
  return found;
}

const NO_FACTS = { declarations: [], carries: [], branches: new Map() };

async function totals(ledger: UsageLedgerAdapter) {
  return buildReport((await ledger.load()).records, NO_FACTS, null, "total").totals;
}

const days = daysOf(CALLS);
const months = monthsOf(CALLS);
const septemberDays = [...days].filter(([name]) => name.startsWith("2026-09"));

/** Every disk state a split of September can be caught in, October still monthly. */
const SPLIT_STATES: readonly (readonly [string, Map<string, string>])[] = [
  ["the monthly file only", new Map(months)],
  ["the monthly file and some of its days", new Map([...months, ...septemberDays.slice(0, 1)])],
  ["the monthly file and all of its days", new Map([...months, ...septemberDays])],
  [
    "its days only",
    new Map([...septemberDays, ...[...months].filter(([name]) => name.startsWith("2026-10"))]),
  ],
];

describe("migrating a ledger kept by month", () => {
  it.each(SPLIT_STATES)("reports the same totals with %s", async (_state, files) => {
    const before = await ledgerAt("before", months);
    const during = await ledgerAt("during", files);
    expect(await totals(during.ledger)).toEqual(await totals(before.ledger));
  });

  it.each(SPLIT_STATES)("leaves only the days once settled, from %s", async (_state, files) => {
    const { dir, ledger } = await ledgerAt("settling", files);
    const fresh = await ledgerAt("fresh", new Map());
    await fresh.ledger.save(CALLS);
    const held = await totals(ledger);
    await settleLedger(ledger);
    expect(await bytes(dir)).toEqual(await bytes(fresh.dir));
    expect(await totals(ledger)).toEqual(held);
  });

  it.each(SPLIT_STATES)(
    "leaves only the days once an ingest's window reaches both months, from %s",
    async (_state, files) => {
      const { dir, ledger } = await ledgerAt("ingesting", files);
      const result = await storeCalls(ledger, [stored("c", "2026-09-30T23:59:00.000Z", 30)]);
      expect(result).toMatchObject({ added: 0, updated: 0 });
      expect(await bytes(dir)).toEqual(Object.fromEntries([...days].sort()));
    }
  );

  it("settles nothing, and writes nothing, on a ledger already in days", async () => {
    const { dir, ledger } = await ledgerAt("settled", days);
    const before = await bytes(dir);
    await writeFile(join(dir, "2026-09-01.jsonl.bak"), "untouched\n");
    expect((await settleLedger(ledger)).unsettled.size).toBe(0);
    expect(await bytes(dir)).toEqual(before);
  });

  it("drops a line that is not a record, wherever it is, once settled", async () => {
    const damaged = new Map(days);
    damaged.set("2026-09-15.jsonl", `${damaged.get("2026-09-15.jsonl")}{torn\n`);
    const { dir, ledger } = await ledgerAt("damaged", damaged);
    expect((await settleLedger(ledger)).skippedLines).toBe(1);
    expect(await bytes(dir)).toEqual(Object.fromEntries([...days].sort()));
  });
});
