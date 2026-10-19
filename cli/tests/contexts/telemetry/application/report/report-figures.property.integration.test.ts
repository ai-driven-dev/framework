import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isMainThread } from "node:worker_threads";
import * as fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  IngestResult,
  IngestUsageUseCase,
} from "../../../../../src/contexts/telemetry/application/ingest-usage-use-case.js";
import { storeCalls } from "../../../../../src/contexts/telemetry/application/ledger-upkeep.js";
import { DeclaredBindings } from "../../../../../src/contexts/telemetry/application/report/declared-bindings.js";
import { reportEnvelopeOf } from "../../../../../src/contexts/telemetry/application/report/report-envelope.js";
import {
  type ReportRequest,
  ReportUsageUseCase,
} from "../../../../../src/contexts/telemetry/application/report/report-usage-use-case.js";
import { declarationOf } from "../../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import type { LeftOutEntry } from "../../../../../src/contexts/telemetry/domain/ports/usage-ledger.js";
import type { Period } from "../../../../../src/contexts/telemetry/domain/report/period.js";
import {
  conflictsOf,
  type ReportFilters,
} from "../../../../../src/contexts/telemetry/domain/report/report-filter.js";
import { REPORT_AXES } from "../../../../../src/contexts/telemetry/domain/report/usage-report.js";
import type { StoredUsage } from "../../../../../src/contexts/telemetry/domain/stored-usage.js";
import { USAGE_AGENTS } from "../../../../../src/contexts/telemetry/domain/usage-record.js";
import { UsageLedgerAdapter } from "../../../../../src/contexts/telemetry/infrastructure/usage-ledger-adapter.js";
import { PrivateStorageAdapter } from "../../../../../src/runtime/filesystem/private-storage-adapter.js";
import {
  FakeLocator,
  InMemoryIdentity,
  InMemorySessions,
  InMemorySnapshots,
} from "../../../../helpers/ports/in-memory-telemetry.js";

/* The figures of a report, every field of its envelope but `run`, depend on what is stored,
 * declared and asked, and on nothing else: not on how the calls reached the ledger, not on what
 * the read before it found, not on the zone of the machine's clock. */

let root: string;
let ledgers = 0;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-report-figures-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/** UTC, and two zones 25 hours apart: whatever reads the local day reads another one. */
const ZONES = ["UTC", "Pacific/Kiritimati", "America/Adak"] as const;
type Zone = (typeof ZONES)[number];
/** The offset `getTimezoneOffset` gives each zone on a day of the calls, so a switch that did
 * not take fails here instead of passing for nothing. */
const OFFSETS: Readonly<Record<Zone, number>> = {
  UTC: 0,
  "Pacific/Kiritimati": -840,
  "America/Adak": 540,
};

/** A month's end inside the days, so a local day crosses a month as well as a day. */
const DAYS = ["2026-09-30", "2026-10-01", "2026-10-02"];
const SESSIONS = ["s-a1", "s-a2", "s-b"];
const REPOSITORIES = ["r-a1", "r-a2", "r-b"];

const snapshot = fc.record({
  minutes: fc.integer({ min: -90, max: 90 }),
  output: fc.option(fc.nat(50), { nil: null, freq: 5 }),
  cacheRead: fc.option(fc.nat(50), { nil: null, freq: 5 }),
});
const call = fc.record({
  day: fc.constantFrom(...DAYS),
  // The first and last hours of a day: a local day is another day in one of the zones.
  hour: fc.constantFrom(0, 1, 11, 22, 23),
  session: fc.constantFrom(...SESSIONS),
  repository: fc.constantFrom(...REPOSITORIES),
  agent: fc.constantFrom(...USAGE_AGENTS),
  model: fc.constantFrom("m-1", "m-2", null),
  snapshots: fc.array(snapshot, { minLength: 1, maxLength: 3 }),
});
const declaration = fc.record({
  session: fc.constantFrom(...SESSIONS),
  task: fc.constantFrom("t-1", "t-2", null),
  ticket: fc.constantFrom("T-1", null),
  day: fc.constantFrom("2026-09-29", ...DAYS),
  hour: fc.constantFrom(0, 12, 23),
});
const edge = fc.option(fc.constantFrom(...DAYS), { nil: null });
const period = fc
  .tuple(edge, edge)
  .map(
    ([a, b]): Period =>
      a !== null && b !== null && a > b ? { from: b, to: a } : { from: a, to: b }
  );
const filters = fc
  .record({
    task: fc.constantFrom(null, "t-1"),
    ticket: fc.constantFrom(null, "T-1"),
    person: fc.constantFrom(null, "p-1"),
    model: fc.constantFrom(null, "m-1"),
    agent: fc.constantFrom(null, ...USAGE_AGENTS),
    session: fc.constantFrom(null, "s-a1", "s-b", "zz"),
    repository: fc.constantFrom(null, "r-a1", "r-b"),
    absent: fc.constantFrom(null, "person" as const, "model" as const, "ticket" as const),
    unattributed: fc.constantFrom(null, "any" as const, "no-binding" as const),
  })
  .filter((f: ReportFilters) => conflictsOf(f).length === 0);

const NOT_STORED_REASONS = [
  "outside-repo",
  "never-seen-alive",
  "no-consent",
  "consent-closed",
  "unreadable-consent",
  "no-cwd",
  "undated",
] as const;
/** What the read before a report may have found: anything, since none of it is a figure. */
const run = fc.record({
  filesRead: fc.nat(9),
  unrecognised: fc.nat(9),
  notStored: fc.tuple(...NOT_STORED_REASONS.map(() => fc.nat(9))),
  consentLogDamaged: fc.boolean(),
  oldestTranscriptAt: fc.option(
    fc.constantFrom("2026-09-01T10:00:00.000Z", "2026-09-30T23:30:00.000Z"),
    { nil: null }
  ),
});
type Run = typeof run extends fc.Arbitrary<infer T> ? T : never;

const scenario = fc.record({
  calls: fc.array(call, { maxLength: 8 }),
  declarations: fc.array(declaration, { maxLength: 4 }),
  person: fc.constantFrom("p-1", null),
  leftOut: fc.array(
    fc.record({
      reason: fc.constantFrom("undated" as const, "unrecognised" as const),
      of: fc.constantFrom("a", "b", "c", "d"),
    }),
    { maxLength: 5 }
  ),
  // Lines no version reads, already on disk, some twice: settling keeps each once, in its day.
  damaged: fc.array(
    fc.record({
      day: fc.constantFrom(...DAYS),
      text: fc.constantFrom("x", "y"),
    }),
    { maxLength: 3 }
  ),
  // Snapshots an earlier ingest already wrote, each in its day, unfolded: both histories start
  // from them, and the first read that reaches a day settles it.
  heldBefore: fc.array(fc.boolean(), { minLength: 40, maxLength: 40 }),
  request: fc.record({ axis: fc.constantFrom(...REPORT_AXES), period, filters }),
  // How another history reached the same data: each snapshot and left-out entry in a batch of
  // its own choosing, the batches in any order, and stores that bring nothing in between.
  history: fc.record({
    batchOf: fc.array(fc.nat(3), { minLength: 40, maxLength: 40 }),
    order: fc.shuffledSubarray([0, 1, 2, 3], { minLength: 4, maxLength: 4 }),
    noOps: fc.nat(2),
  }),
  zones: fc.tuple(fc.constantFrom(...ZONES), fc.constantFrom(...ZONES)),
  runs: fc.tuple(run, run, run),
});
type Scenario = typeof scenario extends fc.Arbitrary<infer T> ? T : never;

function recordsOf(calls: Scenario["calls"]): StoredUsage[] {
  return calls.flatMap((c, index) =>
    c.snapshots.map(
      (s): StoredUsage => ({
        tool: index % 2 === 0 ? "claude-code" : "codex",
        tool_version: "1.0.0",
        key: `k${index}`,
        session_id: c.session,
        agent: c.agent,
        at: new Date(
          Date.parse(`${c.day}T${String(c.hour).padStart(2, "0")}:30:00.000Z`) + s.minutes * 60_000
        ).toISOString(),
        model: c.model,
        input: 1,
        output: s.output,
        cache_read: s.cacheRead,
        cache_write: 0,
        cache_write_1h: null,
        reasoning: null,
        cwd: null,
        git_branch: null,
        repository_id: c.repository,
      })
    )
  );
}

/** A ledger directory as an earlier ingest or a hand edit left it: records in their day's file,
 * unfolded, and lines that are no record. */
async function ledgerWith(
  damaged: readonly { day: string; text: string }[],
  earlier: readonly StoredUsage[] = []
): Promise<UsageLedgerAdapter> {
  ledgers += 1;
  const dir = join(root, `ledger-${ledgers}`);
  await mkdir(dir, { recursive: true });
  const files = new Map<string, string>();
  const put = (name: string, line: string) => files.set(name, `${files.get(name) ?? ""}${line}\n`);
  for (const record of earlier) put(record.at.slice(0, 10), JSON.stringify(record));
  for (const { day, text } of damaged) put(day, text);
  for (const [name, text] of files) await writeFile(join(dir, `${name}.jsonl`), text);
  return new UsageLedgerAdapter(dir, new PrivateStorageAdapter());
}

function ingestResultOf(facts: Run): IngestResult {
  return {
    refused: false,
    filesRead: facts.filesRead,
    added: 0,
    updated: 0,
    unrecognised: facts.unrecognised,
    skippedLedgerLines: 0,
    snapshots: 0,
    notStored: Object.fromEntries(
      NOT_STORED_REASONS.map((reason, n) => [reason, facts.notStored[n]])
    ) as IngestResult["notStored"],
    consentLogDamaged: facts.consentLogDamaged,
    oldestTranscriptAt: facts.oldestTranscriptAt,
  };
}

/** Node moves the clock's zone when `TZ` is set, but only on a process's main thread: a worker
 * thread (Stryker runs Vitest on them) keeps the zone it started in. There the zone is not
 * varied, and the zones are left to the forked suite and to `pnpm test:foreign-clock`. */
async function inZone<T>(zone: Zone, work: () => Promise<T>): Promise<T> {
  if (!isMainThread) return work();
  const before = process.env.TZ;
  process.env.TZ = zone;
  try {
    expect(new Date("2026-10-01T12:00:00.000Z").getTimezoneOffset(), zone).toBe(OFFSETS[zone]);
    return await work();
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
}

/** Reports once over the ledger, after a read that found `facts`, with the clock in `zone`:
 * the envelope, and the figures' bytes, are made in that zone too. */
async function report(
  held: Scenario,
  ledger: UsageLedgerAdapter,
  request: ReportRequest,
  facts: Run,
  zone: Zone
) {
  const sessions = new InMemorySessions();
  for (const d of held.declarations) {
    await sessions.append(
      d.session,
      declarationOf(
        d.task === null ? { kind: "none" } : { kind: "task", task: d.task, ticket: d.ticket },
        new Date(`${d.day}T${String(d.hour).padStart(2, "0")}:00:00.000Z`),
        "command"
      )
    );
  }
  const identity = new InMemoryIdentity();
  identity.personId = held.person;
  const ingest: Pick<IngestUsageUseCase, "execute"> = {
    execute: async () => ingestResultOf(facts),
  };
  return inZone(zone, async () => {
    const result = await new ReportUsageUseCase(
      ingest,
      ledger,
      new DeclaredBindings(sessions, new InMemorySnapshots()),
      identity,
      new FakeLocator(),
      { refusedByEnvironment: false }
    ).execute(request);
    const envelope = result.status === "reported" ? reportEnvelopeOf(result) : result;
    return { envelope, figures: figuresOf(envelope) };
  });
}

/** The figures' bytes: the envelope as printed, but its `run`. */
function figuresOf(envelope: object): string {
  const { run: _run, ...figures } = envelope as Record<string, unknown>;
  return JSON.stringify(figures, null, 2);
}

describe("the figures of a report", () => {
  it("are byte for byte the same whatever history stored the same calls, whatever the read before found, on a second report, and in any zone", async () => {
    await fc.assert(
      fc.asyncProperty(scenario, async (held) => {
        const all = recordsOf(held.calls);
        const wasHeld = (n: number) => held.heldBefore[n % held.heldBefore.length];
        const earlier = all.filter((_, n) => wasHeld(n));
        const records = all.filter((_, n) => !wasHeld(n));
        const leftOut: LeftOutEntry[] = held.leftOut;

        // One history: every call and left-out entry stored at once, reported in UTC.
        const once = await ledgerWith(held.damaged, earlier);
        await once.exclusively(() => storeCalls(once, records));
        await once.leftOut.add(leftOut);
        const reference = await report(held, once, held.request, held.runs[0], "UTC");

        // Another: in batches, in another order, with stores that bring nothing, stored with
        // the clock in another zone.
        const batched = await ledgerWith(held.damaged, earlier);
        const { batchOf, order, noOps } = held.history;
        const nth = (n: number) => batchOf[n % batchOf.length] as number;
        const [first, second] = held.zones;
        await inZone(first, async () => {
          for (const batch of order) {
            const calls = records.filter((_, n) => nth(n) === batch);
            await batched.exclusively(() => storeCalls(batched, calls));
            await batched.leftOut.add(leftOut.filter((_, n) => nth(n + 7) === batch));
            if (batch < noOps) {
              await batched.exclusively(() => storeCalls(batched, []));
              await batched.leftOut.add([]);
            }
          }
        });
        const later = await report(held, batched, held.request, held.runs[1], first);
        const again = await report(held, batched, held.request, held.runs[2], second);

        expect(later.figures).toBe(reference.figures);
        expect(again.figures).toBe(reference.figures);
        if (!("run" in again.envelope)) return;
        // What the read found is in `run`, and only there.
        const facts = held.runs[2];
        expect(again.envelope.run).toEqual({
          files_read: facts.filesRead,
          unrecognised_shapes: facts.unrecognised,
          not_stored: ingestResultOf(facts).notStored,
          consent_log_damaged: facts.consentLogDamaged,
          oldest_transcript_at: facts.oldestTranscriptAt,
          skipped_ledger_lines: again.envelope.run.skipped_ledger_lines,
        });
        expect(Object.keys(again.envelope).at(-1)).toBe("run");
      }),
      { numRuns: 60 }
    );
  }, 120_000);

  it("leave out the ledger lines that are no record, whose count changes once a report has settled them", async () => {
    const held = fc.sample(scenario, { numRuns: 1, seed: 1 })[0] as Scenario;
    const quiet: Run = {
      filesRead: 0,
      unrecognised: 0,
      notStored: [0, 0, 0, 0, 0, 0, 0],
      consentLogDamaged: false,
      oldestTranscriptAt: null,
    };
    const ledger = await ledgerWith([
      { day: "2026-10-01", text: "x" },
      { day: "2026-10-01", text: "x" },
    ]);
    const request: ReportRequest = {
      axis: "day",
      period: { from: "2026-10-01", to: "2026-10-01" },
    };
    const first = await report(held, ledger, request, quiet, "UTC");
    const second = await report(held, ledger, request, quiet, "UTC");
    expect(second.figures).toBe(first.figures);
    // The rewrite kept the line once: the same ledger, read again, counts one fewer.
    expect(first.envelope).toMatchObject({ run: { skipped_ledger_lines: 2 } });
    expect(second.envelope).toMatchObject({ run: { skipped_ledger_lines: 1 } });
  });
});
