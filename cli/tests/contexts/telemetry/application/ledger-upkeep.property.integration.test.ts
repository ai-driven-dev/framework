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
    // Observed on most real calls: the thinking part of `output`, so never above it.
    reasoning: fc.option(fc.nat(5), { nil: null }),
    session: fc.constantFrom("s-1", "s-2"),
  })
  .map(
    ({ keyIndex, tool, offset, output, reasoning, session }): StoredUsage => ({
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
      reasoning: reasoning === null ? null : Math.min(reasoning, output),
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
    // A call the ledger already holds before the first batch.
    held: each(fc.boolean()),
    // A held call that a transcript read again offers once more.
    alsoIngested: each(fc.boolean()),
    tornDay: fc.boolean(),
    strayDay: fc.boolean(),
    // Lines a newer version wrote, or a hand edit left, in days of their own.
    foreign: fc.array(
      fc.record({ anchor: fc.nat(ANCHORS.length - 1), line: fc.nat(FOREIGN.length - 1) }),
      {
        maxLength: 4,
      }
    ),
    // Between batches, a report: none, one with no period, or one on an anchor's window.
    reports: fc.array(fc.option(fc.nat(ANCHORS.length - 1)), { minLength: 5, maxLength: 5 }),
  });
});

/** A line that is not a record, as a crash or a hand edit leaves one. */
const TORN = '{"tool":"claude-code","key":';
/** Lines no reader of this version recognises: a newer version's record, a torn one. */
const FOREIGN = [
  '{"tool":"claude-code","key":"k0","agent":"reviewer","at":"2026-06-15T12:00:00.000Z"}',
  '{"tool":"cursor","key":"k9"}',
  TORN,
];

const dayOfAnchor = (anchor: number): string =>
  new Date(ANCHORS[anchor] as number).toISOString().slice(0, 10);

/** A day no anchor's window reaches, so only a report ever reads it. */
const STRAY_DAY = "2024-06-15.jsonl";

/** The ledger one ingest of these calls would leave: each call once, in canonical order, then
 * each day's kept lines in text order, each once. */
function canonical(
  calls: readonly StoredUsage[],
  kept: ReadonlyMap<string, readonly string[]> = new Map()
): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [day, inDay] of partitionByDay(foldUsage(calls))) {
    files[`${day}.jsonl`] = `${inDay.map((record) => JSON.stringify(record)).join("\n")}\n`;
  }
  for (const [name, lines] of kept) {
    const text = [...new Set(lines)]
      .sort()
      .map((line) => `${line}\n`)
      .join("");
    files[name] = (files[name] ?? "") + text;
  }
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** Every line of the ledger's partitions, as a multiset. */
function linesIn(files: Record<string, string>): string[] {
  return Object.values(files).flatMap((text) => text.split("\n").slice(0, -1));
}

/** The days an earlier ingest of these calls wrote. */
function daysOf(records: readonly StoredUsage[]): Map<string, string> {
  const days = new Map<string, string>();
  for (const [day, inDay] of partitionByDay(foldUsage(records))) {
    days.set(`${day}.jsonl`, `${inDay.map((record) => JSON.stringify(record)).join("\n")}\n`);
  }
  return days;
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
    if (/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name)) {
      found[name] = await readFile(join(dir, name), "utf8");
    }
  }
  return found;
}

describe("the ledger's bytes, once a report has run", () => {
  it("are those of one ingest of the same calls, whatever the order, grouping, starting ledger, damage and lines no reader knows, and no such line is ever lost", async () => {
    await fc.assert(
      fc.asyncProperty(
        scenario,
        async ({
          calls,
          order,
          batchOf,
          held,
          alsoIngested,
          tornDay,
          strayDay,
          foreign,
          reports,
        }) => {
          const earlier = calls.filter((_, index) => held[index]);
          const files = daysOf(earlier);
          const kept = new Map<string, string[]>();
          const keep = (name: string, line: string) =>
            kept.set(name, [...(kept.get(name) ?? []), line]);
          const firstDay = [...files.keys()][0];
          if (tornDay && firstDay !== undefined) {
            files.set(firstDay, `${files.get(firstDay)}${TORN}\n`);
            keep(firstDay, TORN);
          }
          if (strayDay) {
            files.set(STRAY_DAY, `${TORN}\n`);
            keep(STRAY_DAY, TORN);
          }
          const placed = new Map<string, string>();
          for (const { anchor, line } of foreign) {
            const name = `${dayOfAnchor(anchor)}.jsonl`;
            const text = FOREIGN[line] as string;
            placed.set(name, `${placed.get(name) ?? ""}${text}\n`);
            keep(name, text);
          }
          for (const [name, text] of placed) files.set(name, `${files.get(name) ?? ""}${text}`);
          const { dir, ledger } = await freshLedger(files);
          const keptLines = [...kept.values()].flatMap((lines) => [...new Set(lines)]);
          const stillKept = async () => {
            const held = linesIn(await bytes(dir));
            for (const line of keptLines) expect(held).toContain(line);
          };
          const batches: StoredUsage[][] = [[], [], [], [], []];
          for (const index of order) {
            if (!held[index] || alsoIngested[index]) {
              batches[batchOf[index] as number]?.push(calls[index] as StoredUsage);
            }
          }
          for (const [index, batch] of batches.entries()) {
            if (batch.length > 0) await storeCalls(ledger, batch);
            await stillKept();
            const report = reports[index];
            if (report === null) await settleLedger(ledger);
            else if (report !== undefined) {
              const day = dayOfAnchor(report);
              await settleLedger(ledger, (d) => d === day);
            }
            await stillKept();
          }
          await settleLedger(ledger);

          const settled = await bytes(dir);
          expect(settled).toEqual(canonical(calls, kept));
          expect(linesIn(settled)).toHaveLength(
            new Set(calls.map((c) => `${c.tool}\u0000${c.key}`)).size + keptLines.length
          );
          const reference = await freshLedger(
            new Map(
              [...kept].map(([name, lines]) => [name, lines.map((line) => `${line}\n`).join("")])
            )
          );
          await storeCalls(reference.ledger, calls);
          await settleLedger(reference.ledger);
          expect(settled).toEqual(await bytes(reference.dir));

          const again = await settleLedger(ledger);
          expect([again.skippedLines, again.damaged.size, again.unsettled.size]).toEqual([
            keptLines.length,
            kept.size,
            0,
          ]);
          expect(await bytes(dir)).toEqual(settled);
        }
      ),
      { numRuns: 200 }
    );
  }, 240_000);
});
