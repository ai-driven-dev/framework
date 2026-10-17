import { appendFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DirectoryResolver } from "../../../../../src/contexts/telemetry/application/directory-resolver.js";
import {
  type IngestResult,
  IngestUsageUseCase,
} from "../../../../../src/contexts/telemetry/application/ingest-usage-use-case.js";
import { storeCalls } from "../../../../../src/contexts/telemetry/application/ledger-upkeep.js";
import { DeclaredBindings } from "../../../../../src/contexts/telemetry/application/report/declared-bindings.js";
import { reportEnvelopeOf } from "../../../../../src/contexts/telemetry/application/report/report-envelope.js";
import { ReportUsageUseCase } from "../../../../../src/contexts/telemetry/application/report/report-usage-use-case.js";
import { SnapshotBindingsUseCase } from "../../../../../src/contexts/telemetry/application/snapshot-bindings-use-case.js";
import { currentKeyOf } from "../../../../../src/contexts/telemetry/domain/legacy/legacy-usage-key.js";
import type { UsageLedger } from "../../../../../src/contexts/telemetry/domain/ports/usage-ledger.js";
import { attribute } from "../../../../../src/contexts/telemetry/domain/report/attribution.js";
import {
  inPeriod,
  type Period,
  windowOf,
} from "../../../../../src/contexts/telemetry/domain/report/period.js";
import {
  conflictsOf,
  matchesFilter,
  type ReportFilters,
  resolveId,
} from "../../../../../src/contexts/telemetry/domain/report/report-filter.js";
import {
  buildReport,
  REPORT_AXES,
} from "../../../../../src/contexts/telemetry/domain/report/usage-report.js";
import type { StoredUsage } from "../../../../../src/contexts/telemetry/domain/stored-usage.js";
import { USAGE_AGENTS } from "../../../../../src/contexts/telemetry/domain/usage-record.js";
import { UsageLedgerAdapter } from "../../../../../src/contexts/telemetry/infrastructure/usage-ledger-adapter.js";
import { PrivateStorageAdapter } from "../../../../../src/runtime/filesystem/private-storage-adapter.js";
import {
  ALREADY_MIGRATED,
  FakeBindings,
  FakeConsents,
  FakeLocator,
  InMemoryBindingsLock,
  InMemoryConsentHistory,
  InMemoryIdentity,
  InMemoryResolutions,
  InMemorySessions,
  InMemorySnapshots,
} from "../../../../helpers/ports/in-memory-telemetry.js";

let root: string;
let runs = 0;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-report-window-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const DAY_MS = 86_400_000;
/** Just under half a day: two copies of one call around an anchor are under a day apart. */
const HALF_DAY = DAY_MS / 2 - 1;
/** Midnights where a window's edge meets a month or a year end. */
const ANCHORS = [
  "2025-12-31T23:59:00.000Z",
  "2026-02-28T23:30:00.000Z",
  "2026-03-01T00:10:00.000Z",
  "2026-06-15T12:00:00.000Z",
  "2026-06-16T00:00:00.000Z",
  "2026-10-31T23:00:00.000Z",
].map((at) => Date.parse(at));

const dayAt = (instant: number): string => new Date(instant).toISOString().slice(0, 10);
/** Days a period may start or end on: each anchor's day and the two on each side. */
const EDGES = [
  ...new Set(ANCHORS.flatMap((at) => [-2, -1, 0, 1, 2].map((n) => dayAt(at + n * DAY_MS)))),
].sort();

const copy = fc.record({
  offset: fc.integer({ min: -HALF_DAY, max: HALF_DAY }),
  output: fc.nat(5),
  session: fc.constantFrom("s-1", "s-2"),
  model: fc.constantFrom("m-1", "m-2"),
  agent: fc.constantFrom(...USAGE_AGENTS),
  repository: fc.constantFrom("repo-1", "repo-2"),
  // Where this copy sits on disk: its day, its month as an earlier version wrote it, or both,
  // as a split that crashed half-way leaves it.
  placed: fc.constantFrom("day", "month", "both"),
});

const call = fc.record({
  anchor: fc.nat(ANCHORS.length - 1),
  tool: fc.constantFrom("claude-code" as const, "codex" as const),
  copies: fc.array(copy, { minLength: 1, maxLength: 3 }),
});

type Call = typeof call extends fc.Arbitrary<infer T> ? T : never;

const edge = fc.option(fc.constantFrom(...EDGES), { nil: null });
const period = fc
  .tuple(edge, edge)
  .map(
    ([a, b]): Period =>
      a !== null && b !== null && a > b ? { from: b, to: a } : { from: a, to: b }
  );

/** Flags a report may be narrowed by; a start like `s-` may name one session, both or none. */
const filters = fc
  .record({
    task: fc.constant(null),
    ticket: fc.constant(null),
    person: fc.constantFrom(null, "person-a", "person-b"),
    model: fc.constantFrom(null, "m-1", "m-2"),
    agent: fc.constantFrom(null, ...USAGE_AGENTS),
    session: fc.constantFrom(null, "s-1", "s-", "s-2", "x"),
    repository: fc.constantFrom(null, "repo-1", "repo-", "repo-2"),
    absent: fc.constantFrom(null, "person" as const, "model" as const, "ticket" as const),
    unattributed: fc.constantFrom(
      null,
      "any" as const,
      "no-binding" as const,
      "declared-none" as const
    ),
  })
  .filter((f: ReportFilters) => conflictsOf(f).length === 0);

/** What earlier ingests kept of what they measured and could not store. */
const leftOut = fc.array(
  fc.record({
    reason: fc.constantFrom("undated" as const, "unrecognised" as const),
    of: fc.string(),
  }),
  { maxLength: 4 }
);

const scenario = fc.record({
  calls: fc.array(call, { minLength: 1, maxLength: 10 }),
  leftOut,
  period,
  axis: fc.constantFrom(...REPORT_AXES),
  filters,
});

/** Every copy of every call, as the partition files that hold them. */
function filesOf(calls: readonly Call[]): Map<string, string> {
  const files = new Map<string, string>();
  const put = (name: string, record: StoredUsage) =>
    files.set(name, `${files.get(name) ?? ""}${JSON.stringify(record)}\n`);
  calls.forEach(({ anchor, tool, copies }, index) => {
    for (const { offset, output, session, model, agent, repository, placed } of copies) {
      const at = new Date((ANCHORS[anchor] as number) + offset).toISOString();
      const record: StoredUsage = {
        tool,
        tool_version: "1.0.0",
        key: `k${index}`,
        session_id: session,
        agent,
        at,
        model,
        input: 1,
        output,
        cache_read: 0,
        cache_write: 0,
        cache_write_1h: null,
        reasoning: null,
        cwd: null,
        git_branch: null,
        repository_id: repository,
      };
      if (placed !== "month") put(`${at.slice(0, 10)}.jsonl`, record);
      if (placed !== "day") put(`${at.slice(0, 7)}.jsonl`, record);
    }
  });
  return files;
}

async function ledgerWith(files: ReadonlyMap<string, string>): Promise<UsageLedgerAdapter> {
  runs += 1;
  const dir = join(root, `ledger-${runs}`);
  await mkdir(dir, { recursive: true });
  for (const [name, text] of files) await writeFile(join(dir, name), text);
  return new UsageLedgerAdapter(dir, new PrivateStorageAdapter());
}

/** An ingest that finds nothing new, so the report reads the ledger as laid out. */
const NOTHING_NEW: IngestResult = {
  refused: false,
  filesRead: 0,
  added: 0,
  updated: 0,
  unrecognised: 0,
  skippedLedgerLines: 0,
  snapshots: 0,
  notStored: {
    "outside-repo": 0,
    "never-seen-alive": 0,
    "no-consent": 0,
    "consent-closed": 0,
    "unreadable-consent": 0,
    "no-cwd": 0,
    undated: 0,
  },
  consentLogDamaged: false,
  oldestTranscriptAt: null,
};
/** An ingest that reads no tool, so it finds nothing new: `NOTHING_NEW`. */
function ingestOf(ledger: UsageLedger): IngestUsageUseCase {
  const now = () => new Date("2026-10-09T00:00:00.000Z");
  return new IngestUsageUseCase(
    [],
    ledger,
    new DirectoryResolver(
      new FakeLocator(),
      new FakeConsents(),
      new InMemoryResolutions(),
      new InMemoryConsentHistory(),
      { caseInsensitiveFileSystem: false, now }
    ),
    new SnapshotBindingsUseCase(
      new FakeBindings(),
      new InMemorySnapshots(),
      new InMemoryBindingsLock(),
      now
    ),
    { refusedByEnvironment: false },
    ALREADY_MIGRATED
  );
}

describe("a report on a bounded period", () => {
  it("prints the envelope of the full ledger filtered to its period and its filters, byte for byte, what was left out included, and loses no call, when a call's copies are under a day apart", async () => {
    await fc.assert(
      fc.asyncProperty(scenario, async ({ calls, leftOut, period, axis, filters }) => {
        const files = filesOf(calls);
        const declared = new DeclaredBindings(new InMemorySessions(), new InMemorySnapshots());
        const identity = new InMemoryIdentity();
        identity.personId = "person-a";

        const settled = await ledgerWith(files);
        await settled.leftOut.add(leftOut);
        const bounded = await new ReportUsageUseCase(
          ingestOf(settled),
          settled,
          declared,
          identity,
          new FakeLocator(),
          { refusedByEnvironment: false }
        ).execute({ axis, period, filters });

        const fullLedger = await ledgerWith(files);
        await fullLedger.leftOut.add(leftOut);
        const full = await fullLedger.load();
        const kept = full.records.filter((record) => inPeriod(record.at, period));
        // A session or repository typed by its start names a value among the period's calls.
        const resolved: { -readonly [K in keyof ReportFilters]: ReportFilters[K] } = { ...filters };
        for (const flag of ["session", "repository"] as const) {
          const typed = filters[flag];
          if (typed === null) continue;
          const found = resolveId(
            typed,
            kept.map((record) => (flag === "session" ? record.session_id : record.repository_id))
          );
          if (found.kind === "ambiguous") {
            expect(bounded).toEqual({ status: "ambiguous", flag, typed, ids: found.ids });
            return;
          }
          if (found.kind === "found") resolved[flag] = found.id;
        }
        if (bounded.status !== "reported") throw new Error(bounded.status);
        const facts = await declared.read();
        const person = await identity.read();
        const selected = kept.filter((record) =>
          matchesFilter(resolved, record, attribute(record, facts), person)
        );
        const reference = reportEnvelopeOf({
          status: "reported",
          period,
          filters: resolved,
          report: buildReport(selected, facts, person, axis),
          coverage: { records: kept.length, leftOut: await fullLedger.leftOut.counts() },
          run: {
            filesRead: NOTHING_NEW.filesRead,
            unrecognised: NOTHING_NEW.unrecognised,
            notStored: NOTHING_NEW.notStored,
            consentLogDamaged: NOTHING_NEW.consentLogDamaged,
            oldestTranscriptAt: NOTHING_NEW.oldestTranscriptAt,
            skippedLedgerLines: full.skippedLines,
          },
        });
        expect(JSON.stringify(reportEnvelopeOf(bounded))).toBe(JSON.stringify(reference));
        // Whatever the period: each thing kept once, by reason.
        const distinct = new Set(leftOut.map(({ reason, of }) => `${reason}\u0000${of}`));
        expect(bounded.coverage.leftOut).toEqual({
          undated: [...distinct].filter((entry) => entry.startsWith("undated")).length,
          unrecognised: [...distinct].filter((entry) => entry.startsWith("unrecognised")).length,
        });
        // What it settled lost no call, doubled none, and kept the snapshot a full read keeps.
        expect((await settled.load()).records).toEqual(full.records);
      }),
      { numRuns: 100 }
    );
  }, 60_000);
});

/** A call with no request id is keyed by its message and session, and nothing bounds how far
 * apart its copies are written. A call with one keeps its copies under half a day apart, the
 * measured bound. */
const storedCall = fc.record({
  anchor: fc.nat(ANCHORS.length - 1),
  requestless: fc.boolean(),
  copies: fc.array(
    fc.record({
      days: fc.integer({ min: -5, max: 5 }),
      offset: fc.integer({ min: -HALF_DAY, max: HALF_DAY }),
      output: fc.nat(5),
      // Which ingest read this copy.
      ingest: fc.nat(3),
      // Read by an older CLI after the migration: a requestless copy then gets its own
      // timestamped key, appended to its own day.
      older: fc.boolean(),
    }),
    { minLength: 1, maxLength: 3 }
  ),
});

describe("calls stored by ingests, a requestless call's copies days apart, some by an older CLI", () => {
  it("leave every bounded read equal to the full ledger filtered to its period", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(storedCall, { minLength: 1, maxLength: 8 }),
        period,
        async (calls, asked) => {
          const ledger = await ledgerWith(new Map());
          const dir = join(root, `ledger-${runs}`);
          const olderOf = (requestless: boolean, older: boolean) => requestless && older;
          for (let ingest = 0; ingest < 4; ingest += 1) {
            const batch = calls.flatMap(({ anchor, requestless, copies }, index) =>
              copies
                .filter((c) => c.ingest === ingest)
                .map(({ days, offset, output, older }): StoredUsage => {
                  const at = new Date(
                    (ANCHORS[anchor] as number) + (requestless ? days * DAY_MS : 0) + offset
                  ).toISOString();
                  const key = requestless ? `msg_${index}:s-1` : `msg_${index}:req_${index}`;
                  return {
                    tool: "claude-code",
                    tool_version: "1.0.0",
                    key: olderOf(requestless, older) ? `${key}:${at}` : key,
                    session_id: "s-1",
                    agent: "main",
                    at,
                    model: "m-1",
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
                })
            );
            const older = batch.filter((record) => record.key.split(":").length > 2);
            const now = batch.filter((record) => !older.includes(record));
            if (now.length > 0) await storeCalls(ledger, now);
            for (const record of older) {
              await appendFile(
                join(dir, `${record.at.slice(0, 10)}.jsonl`),
                `${JSON.stringify(record)}\n`
              );
            }
          }
          const bounded = (await ledger.load(windowOf(asked))).records;
          const full = (await ledger.load()).records;
          // A stated limit, and the only one: a requestless call an older CLI also stored after
          // the migration may sit in two days until a report with no period settles it, so a
          // bounded read is exempt for that call alone. The full read is never exempt.
          const exempt = new Set(
            calls.flatMap(({ requestless, copies }, index) =>
              copies.some((c) => olderOf(requestless, c.older)) ? [`msg_${index}:s-1`] : []
            )
          );
          const inside = (records: readonly StoredUsage[]) =>
            records.filter((record) => inPeriod(record.at, asked) && !exempt.has(record.key));
          expect(inside(bounded)).toEqual(inside(full));
          // What the limit allows for those calls, and no less: the bounded read holds such a call
          // once when a day of its window holds a copy of it, read off the disk here, and never
          // drops it; the full read holds it once.
          const window = windowOf(asked) ?? (() => true);
          const onDisk = new Set<string>();
          for (const name of await readdir(dir)) {
            if (!/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name) || !window(name.slice(0, 10))) continue;
            for (const line of (await readFile(join(dir, name), "utf8")).split("\n")) {
              if (line !== "") onDisk.add(currentKeyOf(JSON.parse(line)));
            }
          }
          for (const key of exempt) {
            const count = (records: readonly StoredUsage[]) =>
              records.filter((record) => record.key === key).length;
            expect(count(bounded)).toBe(onDisk.has(key) ? 1 : 0);
            expect(count(full)).toBe(1);
            // Over-counting is all the limit allows: once the full read's copy is in the period,
            // its day is in the window and the bounded read keeps that very copy.
            const kept = full.find((record) => record.key === key);
            if (kept !== undefined && inPeriod(kept.at, asked)) {
              expect(bounded.find((record) => record.key === key)).toEqual(kept);
            }
          }
          // One record per call, whatever its copies' spread.
          expect(full.length).toBe(calls.filter((c) => c.copies.length > 0).length);
        }
      ),
      { numRuns: 150 }
    );
  }, 240_000);
});
