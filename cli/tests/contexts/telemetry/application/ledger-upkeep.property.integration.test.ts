import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  settleLedger,
  storeCalls,
} from "../../../../src/contexts/telemetry/application/ledger-upkeep.js";
import {
  partitionByDay,
  type StoredUsage,
} from "../../../../src/contexts/telemetry/domain/stored-usage.js";
import { foldUsage } from "../../../../src/contexts/telemetry/domain/usage-fold.js";
import { UsageLedgerAdapter } from "../../../../src/contexts/telemetry/infrastructure/usage-ledger-adapter.js";
import { PrivateStorageAdapter } from "../../../../src/runtime/filesystem/private-storage-adapter.js";

let root: string;
let runs = 0;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-ledger-property-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const DAY_MS = 86_400_000;
/** Where each key's snapshots gather: month and year ends, so a window crosses them. Four-digit
 * years only, as a partition name has. */
const ANCHORS = [
  "2025-01-31T23:50:00.000Z",
  "2025-12-31T23:55:00.000Z",
  "2026-02-28T23:58:00.000Z",
  "2026-06-15T12:00:00.000Z",
  "2026-10-01T00:02:00.000Z",
  "2027-12-31T23:59:00.000Z",
].map((at) => Date.parse(at));

const call = fc
  .record({
    keyIndex: fc.nat(ANCHORS.length - 1),
    tool: fc.constantFrom("claude-code" as const, "codex" as const),
    // Snapshots of one call are minutes apart; days apart is the case never observed.
    offset: fc.oneof(
      { weight: 9, arbitrary: fc.integer({ min: -30 * 60_000, max: 30 * 60_000 }) },
      { weight: 1, arbitrary: fc.integer({ min: -10 * DAY_MS, max: 10 * DAY_MS }) }
    ),
    output: fc.nat(5),
    session: fc.constantFrom("s-1", "s-2"),
  })
  .map(
    ({ keyIndex, tool, offset, output, session }): StoredUsage => ({
      tool,
      tool_version: "1.0.0",
      key: `k${keyIndex}`,
      session_id: session,
      agent: "main",
      at: new Date((ANCHORS[keyIndex] as number) + offset).toISOString(),
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
    })
  );

const scenario = fc.array(call, { minLength: 1, maxLength: 12 }).chain((calls) => {
  const each = <T>(arbitrary: fc.Arbitrary<T>) =>
    fc.array(arbitrary, { minLength: calls.length, maxLength: calls.length });
  return fc.record({
    calls: fc.constant(calls),
    order: fc.shuffledSubarray(
      calls.map((_, index) => index),
      { minLength: calls.length, maxLength: calls.length }
    ),
    batchOf: each(fc.nat(4)),
    monthly: each(fc.boolean()),
    // A call an earlier version kept that a transcript read again offers once more.
    alsoIngested: each(fc.boolean()),
    tornMonth: fc.boolean(),
    strayDay: fc.boolean(),
  });
});

/** A line that is not a record, as a crash or a hand edit leaves one. */
const TORN = '{"tool":"claude-code","key":';
/** A day no anchor's window reaches, so only a report ever reads it. */
const STRAY_DAY = "2024-06-15.jsonl";

/** The ledger one ingest of these calls would leave: each call once, in canonical order. */
function canonical(calls: readonly StoredUsage[]): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [day, inDay] of partitionByDay(foldUsage(calls))) {
    files[`${day}.jsonl`] = `${inDay.map((record) => JSON.stringify(record)).join("\n")}\n`;
  }
  return files;
}

/** What an earlier version would have written for these calls: one file per month. */
function monthsOf(records: readonly StoredUsage[]): Map<string, string> {
  const months = new Map<string, string>();
  for (const [day, inDay] of partitionByDay(foldUsage(records))) {
    const month = `${day.slice(0, 7)}.jsonl`;
    const text = `${inDay.map((record) => JSON.stringify(record)).join("\n")}\n`;
    months.set(month, (months.get(month) ?? "") + text);
  }
  return months;
}

async function freshLedger(files: ReadonlyMap<string, string> = new Map()) {
  runs += 1;
  const dir = join(root, `ledger-${runs}`);
  await mkdir(dir, { recursive: true });
  for (const [name, text] of files) await writeFile(join(dir, name), text);
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

describe("the ledger's bytes, once a report has run", () => {
  it("are those of one ingest of the same calls, whatever the order, grouping, starting format and damage", async () => {
    await fc.assert(
      fc.asyncProperty(
        scenario,
        async ({ calls, order, batchOf, monthly, alsoIngested, tornMonth, strayDay }) => {
          const earlier = calls.filter((_, index) => monthly[index]);
          const files = monthsOf(earlier);
          const firstMonth = [...files.keys()][0];
          if (tornMonth && firstMonth !== undefined) {
            files.set(firstMonth, `${files.get(firstMonth)}${TORN}\n`);
          }
          if (strayDay) files.set(STRAY_DAY, `${TORN}\n`);
          const { dir, ledger } = await freshLedger(files);
          const batches: StoredUsage[][] = [[], [], [], [], []];
          for (const index of order) {
            if (!monthly[index] || alsoIngested[index]) {
              batches[batchOf[index] as number]?.push(calls[index] as StoredUsage);
            }
          }
          for (const batch of batches) if (batch.length > 0) await storeCalls(ledger, batch);
          await settleLedger(ledger);

          const settled = await bytes(dir);
          expect(settled).toEqual(canonical(calls));
          const lines = Object.values(settled).flatMap((text) => text.split("\n").slice(0, -1));
          expect(lines).toHaveLength(new Set(calls.map((c) => `${c.tool}\u0000${c.key}`)).size);
          const reference = await freshLedger();
          await storeCalls(reference.ledger, calls);
          await settleLedger(reference.ledger);
          expect(settled).toEqual(await bytes(reference.dir));

          const again = await settleLedger(ledger);
          expect([again.skippedLines, again.damaged.size, again.unsettled.size]).toEqual([0, 0, 0]);
          expect(await bytes(dir)).toEqual(settled);
        }
      ),
      { numRuns: 200 }
    );
  }, 240_000);
});
