import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  type BranchSnapshot,
  snapshotKey,
} from "../../../../../src/contexts/telemetry/domain/branch-binding.js";
import type {
  SessionCarry,
  SessionDeclaration,
} from "../../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import type { AttributionFacts } from "../../../../../src/contexts/telemetry/domain/report/attribution.js";
import {
  buildReport,
  COUNTERS,
  REPORT_AXES,
} from "../../../../../src/contexts/telemetry/domain/report/usage-report.js";
import type { StoredUsage } from "../../../../../src/contexts/telemetry/domain/stored-usage.js";

const SESSIONS = ["s-a", "s-b", "s-c", "s-d"];
const REPOS = ["r-a", "r-b"];
const BRANCHES = ["feat/x", "feat/y"];
const TASKS = ["t-1", "t-2", null];
const START = Date.parse("2026-10-01T00:00:00.000Z");
const instant = fc
  .integer({ min: 0, max: 5 * 86_400_000 })
  .map((ms) => new Date(START + ms).toISOString());
const counter = fc.option(fc.integer({ min: 0, max: 1_000_000 }), { nil: null, freq: 4 });

const usage = fc
  .record({
    key: fc.uuid(),
    session_id: fc.constantFrom(...SESSIONS),
    repository_id: fc.constantFrom(...REPOS),
    git_branch: fc.option(fc.constantFrom(...BRANCHES), { nil: null }),
    model: fc.option(fc.constantFrom("m-1", "m-2"), { nil: null }),
    at: instant,
    input: counter,
    output: counter,
    cache_read: counter,
    cache_write: counter,
  })
  .map(
    (r): StoredUsage => ({
      ...r,
      tool: "claude-code",
      tool_version: null,
      agent: "main",
      cache_write_1h: null,
      reasoning: null,
      cwd: null,
    })
  );

const declaration = fc
  .record({
    session_id: fc.constantFrom(...SESSIONS),
    task: fc.constantFrom(...TASKS),
    ticket: fc.option(fc.constantFrom("T-1", "T-2"), { nil: null }),
    declared_at: instant,
  })
  .map((d): SessionDeclaration => ({ ...d, none: d.task === null, by: "command" }));
const carry = fc
  .record({
    session_id: fc.constantFrom(...SESSIONS),
    from: fc.constantFrom(...SESSIONS),
    at: instant,
  })
  .filter((c) => c.session_id !== c.from);
const snapshot = fc
  .record({
    repository_id: fc.constantFrom(...REPOS),
    branch: fc.constantFrom(...BRANCHES),
    task: fc.constantFrom(...TASKS),
    ticket: fc.option(fc.constantFrom("T-1", "T-2"), { nil: null }),
    branch_created_at: fc.option(instant, { nil: null }),
  })
  .map(
    (s): BranchSnapshot => ({
      ...s,
      none: s.task === null,
      declared_at: "2026-10-01T00:00:00.000Z",
      snapshot_at: "2026-10-01T00:00:00.000Z",
    })
  );
const facts = fc
  .record({
    declarations: fc.array(declaration, { maxLength: 6 }),
    carries: fc.array(carry, { maxLength: 4 }) as fc.Arbitrary<SessionCarry[]>,
    branches: fc.array(snapshot, { maxLength: 4 }),
  })
  .map(
    (f): AttributionFacts => ({
      ...f,
      branches: new Map(f.branches.map((b) => [snapshotKey(b.repository_id, b.branch), b])),
    })
  );

interface Oracle {
  known: Record<(typeof COUNTERS)[number], number>;
  unknown: Record<(typeof COUNTERS)[number], number>;
  total: number;
  recordsWithUnknown: number;
}

/** The oracle: plain loops over the records, sharing nothing with the aggregation. */
function expected(records: readonly StoredUsage[]): Oracle {
  const oracle: Oracle = {
    known: { input: 0, output: 0, cache_read: 0, cache_write: 0 },
    unknown: { input: 0, output: 0, cache_read: 0, cache_write: 0 },
    total: 0,
    recordsWithUnknown: 0,
  };
  for (const record of records) {
    let unknown = false;
    for (const name of COUNTERS) {
      const value = record[name];
      if (value === null) {
        oracle.unknown[name] += 1;
        unknown = true;
      } else {
        oracle.known[name] += value;
        oracle.total += value;
      }
    }
    if (unknown) oracle.recordsWithUnknown += 1;
  }
  return oracle;
}

describe("every axis of a report adds up to the same totals", () => {
  it("on any ledger, unknown counters included", () => {
    fc.assert(
      fc.property(
        fc.array(usage, { maxLength: 40 }),
        facts,
        fc.option(fc.constant("p-1"), { nil: null }),
        (records, attributionFacts, person) => {
          const oracle = expected(records);
          for (const axis of REPORT_AXES) {
            const { rows, totals } = buildReport(records, attributionFacts, person, axis);
            const sum = (pick: (row: (typeof rows)[number]) => number) =>
              rows.reduce((n, row) => n + pick(row), 0);
            expect(totals.records).toBe(records.length);
            expect(sum((row) => row.records)).toBe(records.length);
            expect(totals.total).toEqual({
              known: oracle.total,
              unknownRecords: oracle.recordsWithUnknown,
            });
            expect(sum((row) => row.total.known)).toBe(oracle.total);
            expect(sum((row) => row.total.unknownRecords)).toBe(oracle.recordsWithUnknown);
            for (const name of COUNTERS) {
              expect(totals.counters[name]).toEqual({
                known: oracle.known[name],
                unknownRecords: oracle.unknown[name],
              });
              expect(sum((row) => row.counters[name].known)).toBe(oracle.known[name]);
              expect(sum((row) => row.counters[name].unknownRecords)).toBe(oracle.unknown[name]);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("whatever order the records arrive in", () => {
    fc.assert(
      fc.property(fc.array(usage, { maxLength: 30 }), facts, (records, attributionFacts) => {
        for (const axis of REPORT_AXES) {
          expect(buildReport([...records].reverse(), attributionFacts, null, axis)).toEqual(
            buildReport(records, attributionFacts, null, axis)
          );
        }
      }),
      { numRuns: 100 }
    );
  });
});
