import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DirectoryResolver } from "../../../../../src/contexts/telemetry/application/directory-resolver.use-case.js";
import {
  IngestUsage,
  type IngestUsageResult,
} from "../../../../../src/contexts/telemetry/application/ingest-usage.use-case.js";
import { storeCalls } from "../../../../../src/contexts/telemetry/application/ledger-upkeep.js";
import { DeclaredBindings } from "../../../../../src/contexts/telemetry/application/report/declared-bindings.js";
import { reportEnvelopeOf } from "../../../../../src/contexts/telemetry/application/report/report-envelope.js";
import { ReportUsage } from "../../../../../src/contexts/telemetry/application/report/report-usage.use-case.js";
import { SnapshotBindings } from "../../../../../src/contexts/telemetry/application/snapshot-bindings.use-case.js";
import type { Period } from "../../../../../src/contexts/telemetry/contract/period.js";
import type { ReportFilters } from "../../../../../src/contexts/telemetry/contract/report-filter.js";
import {
  USAGE_AGENTS,
  USAGE_TOOLS,
} from "../../../../../src/contexts/telemetry/contract/usage-record.js";
import { REPORT_AXES } from "../../../../../src/contexts/telemetry/contract/usage-report.js";
import { attribute } from "../../../../../src/contexts/telemetry/domain/report/attribution.js";
import { inPeriod, windowOf } from "../../../../../src/contexts/telemetry/domain/report/period.js";
import {
  conflictsOf,
  matchesFilter,
  resolveId,
} from "../../../../../src/contexts/telemetry/domain/report/report-filter.js";
import { buildReport } from "../../../../../src/contexts/telemetry/domain/report/usage-report.js";
import type { StoredUsage } from "../../../../../src/contexts/telemetry/domain/stored-usage.js";
import type { UsageLedgerAdapter } from "../../../../../src/contexts/telemetry/infrastructure/storage/ledger/usage-ledger-adapter.js";
import type { UsageLedger } from "../../../../../src/contexts/telemetry/ports/usage-ledger.js";
import { PrivateStorageAdapter } from "../../../../../src/shared/infrastructure/private-storage-adapter.js";
import { FakeBindings } from "../../testing/fake-bindings.fake.js";
import { FakeConsents } from "../../testing/fake-consents.fake.js";
import { FakeLocator } from "../../testing/fake-locator.fake.js";
import { InMemoryBindingsLock } from "../../testing/in-memory-bindings-lock.fake.js";
import { InMemoryConsentHistory } from "../../testing/in-memory-consent-history.fake.js";
import { InMemoryIdentity } from "../../testing/in-memory-identity.fake.js";
import { InMemoryResolutions } from "../../testing/in-memory-resolutions.fake.js";
import { InMemorySessions } from "../../testing/in-memory-sessions.fake.js";
import { InMemorySnapshots } from "../../testing/in-memory-snapshots.fake.js";
import { ledgerOver } from "../../testing/ledger-adapters.builder.js";

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
});

const call = fc.record({
  anchor: fc.nat(ANCHORS.length - 1),
  tool: fc.constantFrom("claude-code" as const, "codex" as const),
  // A Claude Code call with no request id, as an earlier or an older CLI stored it: a line this
  // version does not accept.
  keyed: fc.constantFrom("request", "session", "timestamped"),
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
    tool: fc.constantFrom(null, ...USAGE_TOOLS),
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

type Copy = Call["copies"][number];

/** One copy of a call, as an earlier ingest or an older CLI stored it. */
function copyOf(index: number, { anchor, tool, keyed }: Call, copy: Copy): StoredUsage {
  const { offset, output, session, model, agent, repository } = copy;
  const at = new Date((ANCHORS[anchor] ?? 0) + offset).toISOString();
  const requestless = tool === "claude-code" && keyed !== "request";
  return {
    tool,
    tool_version: "1.0.0",
    key: requestless
      ? `msg_${index}:${session}${keyed === "timestamped" ? `:${at}` : ""}`
      : `k${index}`,
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
}

/** Every copy of every call, as the partition files that hold them. */
function filesOf(calls: readonly Call[]): Map<string, string> {
  const files = new Map<string, string>();
  for (const [index, call] of calls.entries()) {
    for (const copy of call.copies) {
      const record = copyOf(index, call, copy);
      const name = `${record.at.slice(0, 10)}.jsonl`;
      files.set(name, `${files.get(name) ?? ""}${JSON.stringify(record)}\n`);
    }
  }
  return files;
}

async function ledgerWith(files: ReadonlyMap<string, string>): Promise<UsageLedgerAdapter> {
  runs += 1;
  const dir = join(root, `ledger-${runs}`);
  await mkdir(dir, { recursive: true });
  for (const [name, text] of files) await writeFile(join(dir, name), text);
  return ledgerOver(dir, new PrivateStorageAdapter());
}

/** An ingest that finds nothing new, so the report reads the ledger as laid out. */
const NOTHING_NEW: IngestUsageResult = {
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
function ingestOf(ledger: UsageLedger): IngestUsage {
  const now = () => new Date("2026-10-09T00:00:00.000Z");
  return new IngestUsage({
    readers: [],
    ledger,
    directories: new DirectoryResolver({
      locator: new FakeLocator(),
      consentSource: new FakeConsents(),
      store: new InMemoryResolutions(),
      history: new InMemoryConsentHistory(),
      environment: { caseInsensitiveFileSystem: false, now },
    }),
    snapshots: new SnapshotBindings({
      source: new FakeBindings(),
      store: new InMemorySnapshots(),
      lock: new InMemoryBindingsLock(),
      now,
    }),
    options: { environment: { get: () => undefined } },
  });
}

type Typed = { -readonly [K in keyof ReportFilters]: ReportFilters[K] };

/** A session or repository typed by its start names a value among the period's calls. */
function resolveFlags(filters: ReportFilters, kept: readonly StoredUsage[]) {
  const resolved: Typed = { ...filters };
  for (const flag of ["session", "repository"] as const) {
    const typed = filters[flag];
    if (typed === null) continue;
    const found = resolveId(
      typed,
      kept.map((record) => (flag === "session" ? record.session_id : record.repository_id))
    );
    if (found.kind === "ambiguous") return { ambiguous: { flag, typed, ids: found.ids } };
    if (found.kind === "found") resolved[flag] = found.id;
  }
  return { resolved };
}

/** What the report of the full ledger, filtered to the period and the flags, says. */
async function referenceOf(input: {
  full: Awaited<ReturnType<UsageLedgerAdapter["load"]>>;
  kept: readonly StoredUsage[];
  fullLedger: UsageLedgerAdapter;
  declared: DeclaredBindings;
  resolved: Typed;
  period: Period;
  axis: (typeof REPORT_AXES)[number];
}) {
  const { full, kept, fullLedger, declared, resolved, period, axis } = input;
  const { facts, person } = await declared.read();
  const selected = kept.filter((record) =>
    matchesFilter({ filters: resolved, record, attribution: attribute(record, facts), person })
  );
  return reportEnvelopeOf({
    status: "reported",
    period,
    filters: resolved,
    report: buildReport({ records: selected, facts, person, axis }),
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
}

/** The figures: `run` is what this read found, and a bounded read finds less. */
const figuresOf = (envelope: object) => JSON.stringify({ ...envelope, run: undefined });

/** Whatever the period: each thing kept once, by reason. */
function distinctLeftOut(entries: readonly { reason: string; of: string }[]) {
  const distinct = new Set(entries.map(({ reason, of }) => `${reason}\u0000${of}`));
  const count = (reason: string) => [...distinct].filter((e) => e.startsWith(reason)).length;
  return { undated: count("undated"), unrecognised: count("unrecognised"), requestless: 0 };
}

describe("a report on a bounded period", () => {
  it("prints the figures of the full ledger filtered to its period and its filters, byte for byte, what was left out included, and loses no call, when a call's copies are under a day apart", async () => {
    await fc.assert(
      fc.asyncProperty(scenario, async ({ calls, leftOut, period, axis, filters }) => {
        const files = filesOf(calls);
        const identity = new InMemoryIdentity();
        identity.personId = "person-a";
        const declared = new DeclaredBindings(
          new InMemorySessions(),
          new InMemorySnapshots(),
          identity
        );

        const settled = await ledgerWith(files);
        await settled.leftOut.add(leftOut);
        const bounded = await new ReportUsage({
          ingest: ingestOf(settled),
          ledger: settled,
          declared,
          locator: new FakeLocator(),
          environment: { get: () => undefined },
        }).execute({ axis, period, filters });

        const fullLedger = await ledgerWith(files);
        await fullLedger.leftOut.add(leftOut);
        const full = await fullLedger.load();
        const kept = full.records.filter((record) => inPeriod(record.at, period));
        const resolution = resolveFlags(filters, kept);
        if ("ambiguous" in resolution) {
          expect(bounded).toEqual({ status: "ambiguous", ...resolution.ambiguous });
          return;
        }
        if (bounded.status !== "reported") throw new Error(bounded.status);
        const reference = await referenceOf({
          full,
          kept,
          fullLedger,
          declared,
          resolved: resolution.resolved,
          period,
          axis,
        });
        expect(figuresOf(reportEnvelopeOf(bounded))).toBe(figuresOf(reference));
        expect(bounded.coverage.leftOut).toEqual(distinctLeftOut(leftOut));
        // What it settled lost no call, doubled none, and kept the snapshot a full read keeps.
        expect((await settled.load()).records).toEqual(full.records);
      }),
      { numRuns: 100 }
    );
  }, 60_000);
});

/** A call with a request id keeps its copies under half a day apart, the measured bound. A
 * call with none is never stored by this version: its copies are lines an earlier or an older
 * CLI wrote, keyed by message and session, or by its own timestamp too, any days apart. */
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
      timestamped: fc.boolean(),
    }),
    { minLength: 1, maxLength: 3 }
  ),
});

type Stored = typeof storedCall extends fc.Arbitrary<infer T> ? T : never;

/** One copy of a call as an ingest stored it, or a CLI of an older kind wrote it. */
function storedCopy(index: number, call: Stored, copy: Stored["copies"][number]): StoredUsage {
  const { anchor, requestless } = call;
  const { days, offset, output, timestamped } = copy;
  const at = new Date(
    (ANCHORS[anchor] ?? 0) + (requestless ? days * DAY_MS : 0) + offset
  ).toISOString();
  const key = requestless ? `msg_${index}:s-1` : `msg_${index}:req_${index}`;
  return {
    tool: "claude-code",
    tool_version: "1.0.0",
    key: requestless && timestamped ? `${key}:${at}` : key,
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
}

/** What one ingest brings: calls with a request id are stored, the others appended as lines. */
async function ingestCopies(ledger: UsageLedgerAdapter, dir: string, calls: Stored[], n: number) {
  const batch = calls.flatMap((call, index) =>
    call.copies
      .filter((copy) => copy.ingest === n)
      .map((copy) => ({ requestless: call.requestless, record: storedCopy(index, call, copy) }))
  );
  const now = batch.filter((c) => !c.requestless).map((c) => c.record);
  if (now.length > 0) await storeCalls(ledger, now);
  for (const { record } of batch.filter((c) => c.requestless)) {
    await appendFile(join(dir, `${record.at.slice(0, 10)}.jsonl`), `${JSON.stringify(record)}\n`);
  }
}

describe("calls stored by ingests, beside lines of calls with no request id any CLI wrote", () => {
  it("leave every bounded read equal to the full ledger filtered to its period", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(storedCall, { minLength: 1, maxLength: 8 }),
        period,
        async (calls, asked) => {
          const ledger = await ledgerWith(new Map());
          const dir = join(root, `ledger-${runs}`);
          for (let ingest = 0; ingest < 4; ingest += 1) {
            await ingestCopies(ledger, dir, calls, ingest);
          }
          const bounded = (await ledger.load(windowOf(asked))).records;
          const full = (await ledger.load()).records;
          const inside = (records: readonly StoredUsage[]) =>
            records.filter((record) => inPeriod(record.at, asked));
          expect(inside(bounded)).toEqual(inside(full));
          // One record per call with a request id, whatever its copies' spread; none without.
          expect(full.length).toBe(calls.filter((c) => !c.requestless).length);
        }
      ),
      { numRuns: 150 }
    );
  }, 240_000);
});
