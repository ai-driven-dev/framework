import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DirectoryResolver } from "../../../../../src/contexts/telemetry/application/directory-resolver.js";
import { IngestUsageUseCase } from "../../../../../src/contexts/telemetry/application/ingest-usage-use-case.js";
import { DeclaredBindings } from "../../../../../src/contexts/telemetry/application/report/declared-bindings.js";
import {
  type EnvelopeRow,
  type EnvelopeTally,
  type ReportEnvelope,
  reportEnvelopeOf,
} from "../../../../../src/contexts/telemetry/application/report/report-envelope.js";
import {
  type ReportRequest,
  ReportUsageUseCase,
} from "../../../../../src/contexts/telemetry/application/report/report-usage-use-case.js";
import { SnapshotBindingsUseCase } from "../../../../../src/contexts/telemetry/application/snapshot-bindings-use-case.js";
import { declarationOf } from "../../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import type { Period } from "../../../../../src/contexts/telemetry/domain/report/period.js";
import {
  conflictsOf,
  NO_FILTERS,
  type ReportFilters,
} from "../../../../../src/contexts/telemetry/domain/report/report-filter.js";
import {
  REPORT_AXES,
  type ReportAxis,
} from "../../../../../src/contexts/telemetry/domain/report/usage-report.js";
import type { StoredUsage } from "../../../../../src/contexts/telemetry/domain/stored-usage.js";
import { USAGE_AGENTS } from "../../../../../src/contexts/telemetry/domain/usage-record.js";
import {
  ALREADY_MIGRATED,
  FakeBindings,
  FakeConsents,
  FakeLocator,
  InMemoryBindingsLock,
  InMemoryConsentHistory,
  InMemoryIdentity,
  InMemoryLedger,
  InMemoryResolutions,
  InMemorySessions,
  InMemorySnapshots,
} from "../../../../helpers/ports/in-memory-telemetry.js";

/** Two sessions share a start, so a prefix can name one, the other, or both. */
const SESSIONS = [
  "a1b2c3d4-0000-4000-8000-000000000001",
  "a1b2ffff-0000-4000-8000-000000000002",
  "b0000000-0000-4000-8000-000000000003",
];
const REPOSITORIES = ["r-a1", "r-a2", "r-b"];
const DAYS = ["2026-10-01", "2026-10-02", "2026-10-03"];
const TASKS = ["t-1", "t-2", null];
const TICKETS = ["T-1", null];

const call = fc.record({
  session: fc.constantFrom(...SESSIONS),
  repository: fc.constantFrom(...REPOSITORIES),
  agent: fc.constantFrom(...USAGE_AGENTS),
  model: fc.constantFrom("m-1", "m-2", null),
  day: fc.constantFrom(...DAYS),
  hour: fc.integer({ min: 0, max: 23 }),
  input: fc.option(fc.nat(9), { nil: null, freq: 4 }),
});
const declaration = fc.record({
  session: fc.constantFrom(...SESSIONS),
  task: fc.constantFrom(...TASKS),
  ticket: fc.constantFrom(...TICKETS),
  day: fc.constantFrom("2026-09-30", ...DAYS),
});
const edge = fc.option(fc.constantFrom(...DAYS), { nil: null });
const period = fc
  .tuple(edge, edge)
  .map(
    ([a, b]): Period =>
      a !== null && b !== null && a > b ? { from: b, to: a } : { from: a, to: b }
  );

const ledgerOf = fc.record({
  calls: fc.array(call, { maxLength: 12 }),
  declarations: fc.array(declaration, { maxLength: 4 }),
  person: fc.constantFrom("p-1", null),
});
type Ledger = typeof ledgerOf extends fc.Arbitrary<infer T> ? T : never;

/** A report over a ledger laid out as given. Each call's output is its own power of two, so
 * the output a report sums names the very calls it kept. */
async function reporterOf({ calls, declarations, person }: Ledger) {
  const ledger = new InMemoryLedger();
  ledger.records = calls.map(
    (c, index): StoredUsage => ({
      tool: index % 2 === 0 ? "claude-code" : "codex",
      tool_version: null,
      key: `k${index}`,
      session_id: c.session,
      agent: c.agent,
      at: `${c.day}T${String(c.hour).padStart(2, "0")}:00:00.000Z`,
      model: c.model,
      input: c.input,
      output: 2 ** index,
      cache_read: 0,
      cache_write: 0,
      cache_write_1h: null,
      reasoning: null,
      cwd: null,
      git_branch: null,
      repository_id: c.repository,
    })
  );
  const sessions = new InMemorySessions();
  for (const d of declarations) {
    await sessions.append(
      d.session,
      declarationOf(
        d.task === null ? { kind: "none" } : { kind: "task", task: d.task, ticket: d.ticket },
        new Date(`${d.day}T12:00:00.000Z`),
        "command"
      )
    );
  }
  const identity = new InMemoryIdentity();
  identity.personId = person;
  const now = () => new Date("2026-10-09T00:00:00.000Z");
  const snapshots = new InMemorySnapshots();
  const use = new ReportUsageUseCase(
    new IngestUsageUseCase(
      [],
      ledger,
      new DirectoryResolver(
        new FakeLocator(),
        new FakeConsents(),
        new InMemoryResolutions(),
        new InMemoryConsentHistory(),
        { caseInsensitiveFileSystem: false, now }
      ),
      new SnapshotBindingsUseCase(new FakeBindings(), snapshots, new InMemoryBindingsLock(), now),
      { refusedByEnvironment: false },
      ALREADY_MIGRATED
    ),
    ledger,
    new DeclaredBindings(sessions, snapshots),
    identity,
    new FakeLocator(),
    { refusedByEnvironment: false }
  );
  return async (request: ReportRequest): Promise<ReportEnvelope> => {
    const result = await use.execute(request);
    if (result.status !== "reported") throw new Error(`not reported: ${result.status}`);
    return reportEnvelopeOf(result);
  };
}

function tallyOf(row: EnvelopeRow): EnvelopeTally {
  const { kind: _kind, key: _key, reason: _reason, ...tally } = row;
  return tally;
}

/** The rows of a report, added counter by counter. */
function sumOf(rows: readonly EnvelopeRow[]): EnvelopeTally {
  const zero = { tokens: 0, unknown_records: 0 };
  const add = (a: typeof zero, b: typeof zero) => ({
    tokens: a.tokens + b.tokens,
    unknown_records: a.unknown_records + b.unknown_records,
  });
  return rows.map(tallyOf).reduce(
    (sum, row) => ({
      records: sum.records + row.records,
      input: add(sum.input, row.input),
      output: add(sum.output, row.output),
      cache_read: add(sum.cache_read, row.cache_read),
      cache_write: add(sum.cache_write, row.cache_write),
      total: add(sum.total, row.total),
    }),
    { records: 0, input: zero, output: zero, cache_read: zero, cache_write: zero, total: zero }
  );
}

/** What a person types to select one row, as the usage contract lists it. */
function selectionOf(axis: ReportAxis, row: EnvelopeRow): Partial<ReportRequest> {
  if (axis === "total") return {};
  if (axis === "day") return { period: { from: row.key, to: row.key } };
  if (row.kind === "absent") {
    return { filters: { ...NO_FILTERS, absent: axis as ReportFilters["absent"] } };
  }
  if (row.kind === "unattributed") return { filters: { ...NO_FILTERS, unattributed: row.reason } };
  return { filters: { ...NO_FILTERS, [axis]: row.key } };
}

const filters = fc
  .record({
    task: fc.constantFrom(null, ...TASKS.filter((t) => t !== null), "t-none"),
    ticket: fc.constantFrom(null, "T-1"),
    person: fc.constantFrom(null, "p-1"),
    model: fc.constantFrom(null, "m-1", "m-2"),
    agent: fc.constantFrom(null, ...USAGE_AGENTS),
    // Each names at most one value: a start two values share is refused, not combined.
    session: fc.constantFrom(null, "a1b2c", "a1b2f", SESSIONS[2] as string, "zz"),
    repository: fc.constantFrom(null, "r-a1", "r-b"),
    absent: fc.constantFrom(null, "person" as const, "model" as const, "ticket" as const),
    unattributed: fc.constantFrom(
      null,
      "any" as const,
      "no-binding" as const,
      "declared-none" as const
    ),
  })
  .filter((f: ReportFilters) => conflictsOf(f).length === 0);

describe("a filtered report", () => {
  it("adds up to the row it selects, and every axis of it adds up to its totals", async () => {
    await fc.assert(
      fc.asyncProperty(
        ledgerOf,
        period,
        fc.constantFrom(...REPORT_AXES),
        async (held, base, axis) => {
          const report = await reporterOf(held);
          const whole = await report({ axis, period: base });
          for (const row of whole.rows) {
            const selection = { period: base, ...selectionOf(axis, row) };
            for (const each of REPORT_AXES) {
              const narrowed = await report({ ...selection, axis: each });
              expect(narrowed.totals).toEqual(tallyOf(row));
              expect(sumOf(narrowed.rows)).toEqual(narrowed.totals);
            }
          }
        }
      ),
      { numRuns: 60 }
    );
  }, 60_000);

  it("keeps the calls every one of its filters keeps alone", async () => {
    await fc.assert(
      fc.asyncProperty(ledgerOf, period, filters, async (held, base, given) => {
        const report = await reporterOf(held);
        const kept = async (only: ReportFilters) =>
          (await report({ axis: "total", period: base, filters: only })).totals.output.tokens;
        let alone = (await kept(NO_FILTERS)) as number;
        for (const [flag, value] of Object.entries(given)) {
          if (value !== null) alone &= await kept({ ...NO_FILTERS, [flag]: value });
        }
        expect(await kept(given)).toBe(alone);
      }),
      { numRuns: 200 }
    );
  }, 60_000);
});
