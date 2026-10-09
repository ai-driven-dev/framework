import { describe, expect, it } from "vitest";
import { snapshotKey } from "../../../../../src/contexts/telemetry/domain/branch-binding.js";
import type { SessionDeclaration } from "../../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import type { AttributionFacts } from "../../../../../src/contexts/telemetry/domain/report/attribution.js";
import {
  type AxisValue,
  buildReport,
  REPORT_AXES,
  type ReportAxis,
} from "../../../../../src/contexts/telemetry/domain/report/usage-report.js";
import type { StoredUsage } from "../../../../../src/contexts/telemetry/domain/stored-usage.js";

let counter = 0;
const call = (over: Partial<StoredUsage> = {}): StoredUsage => {
  counter += 1;
  return {
    tool: "claude-code",
    tool_version: null,
    key: `k${counter}`,
    session_id: "s-1",
    agent: "main",
    at: "2026-10-02T10:00:00.000Z",
    model: "m-1",
    input: 1,
    output: 10,
    cache_read: 100,
    cache_write: 1000,
    cache_write_1h: null,
    reasoning: null,
    cwd: null,
    git_branch: null,
    repository_id: "repo-a",
    ...over,
  };
};
const declaration = (session: string, task: string | null, ticket: string | null = null) =>
  ({
    session_id: session,
    task,
    ticket,
    none: task === null,
    declared_at: "2026-10-01T00:00:00.000Z",
    by: "command",
  }) satisfies SessionDeclaration;
const noFacts: AttributionFacts = { declarations: [], carries: [], branches: new Map() };
const withDeclarations = (...declarations: SessionDeclaration[]): AttributionFacts => ({
  ...noFacts,
  declarations,
});
const values = (
  axis: ReportAxis,
  records: StoredUsage[],
  facts = noFacts,
  person: string | null = null
) => buildReport(records, facts, person, axis).rows.map((row) => row.value);
const v = (value: string): AxisValue => ({ kind: "value", value });

describe("a usage report", () => {
  it("keeps the four counters apart and adds them into a row total", () => {
    const report = buildReport([call(), call()], noFacts, null, "total");
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      value: v("total"),
      records: 2,
      counters: {
        input: { known: 2, unknownRecords: 0 },
        output: { known: 20, unknownRecords: 0 },
        cache_read: { known: 200, unknownRecords: 0 },
        cache_write: { known: 2000, unknownRecords: 0 },
      },
      total: { known: 2222, unknownRecords: 0 },
    });
    expect(report.totals).toEqual({
      records: report.rows[0]?.records,
      counters: report.rows[0]?.counters,
      total: report.rows[0]?.total,
    });
  });

  it("leaves an unknown counter out of the sum and counts it, never adding it as zero", () => {
    const report = buildReport(
      [call({ cache_read: null }), call({ cache_read: 5 }), call({ output: null, input: null })],
      noFacts,
      null,
      "total"
    );
    expect(report.totals.counters.cache_read).toEqual({ known: 105, unknownRecords: 1 });
    expect(report.totals.counters.input).toEqual({ known: 2, unknownRecords: 1 });
    expect(report.totals.counters.output).toEqual({ known: 20, unknownRecords: 1 });
    expect(report.totals.counters.cache_write).toEqual({ known: 3000, unknownRecords: 0 });
    expect(report.totals.total).toEqual({ known: 3000 + 2 + 20 + 105 + 0 + 0, unknownRecords: 2 });
  });

  it("counts a record with several unknown counters once in the total", () => {
    const report = buildReport([call({ input: null, output: null })], noFacts, null, "total");
    expect(report.totals.total.unknownRecords).toBe(1);
  });

  it("splits by day in UTC, in order of the days and not of their size", () => {
    const rows = values("day", [
      call({ at: "2026-10-02T00:00:00.000Z", output: 1 }),
      call({ at: "2026-10-01T23:59:59.999Z", output: 500 }),
      call({ at: "2026-10-02T23:59:59.999Z", output: 1 }),
    ]);
    expect(rows).toEqual([v("2026-10-01"), v("2026-10-02")]);
  });

  it("splits by session, model and repository, the largest first", () => {
    const records = [
      call({ session_id: "a-small", model: "m-a", repository_id: "r-a", output: 1 }),
      call({ session_id: "z-big", model: "m-z", repository_id: "r-z", output: 500 }),
    ];
    expect(values("session", records)).toEqual([v("z-big"), v("a-small")]);
    expect(values("model", records)).toEqual([v("m-z"), v("m-a")]);
    expect(values("repository", records)).toEqual([v("r-z"), v("r-a")]);
  });

  it("orders rows of the same size by their text", () => {
    const records = [call({ session_id: "s-b" }), call({ session_id: "s-a" })];
    expect(values("session", records)).toEqual([v("s-a"), v("s-b")]);
  });

  it("gives a call with no model its own row", () => {
    expect(values("model", [call({ model: null }), call()])).toEqual([
      v("m-1"),
      { kind: "absent" },
    ]);
  });

  it("is one row of the person when one is named, and one of nobody when not", () => {
    expect(values("person", [call(), call()], noFacts, "p-1")).toEqual([v("p-1")]);
    expect(values("person", [call(), call()])).toEqual([{ kind: "absent" }]);
  });

  it("splits by task and puts what has none on rows of their own, by reason", () => {
    const facts = withDeclarations(declaration("s-task", "checkout"), declaration("s-none", null));
    const rows = values(
      "task",
      [
        call({ session_id: "s-task" }),
        call({ session_id: "s-none" }),
        call({ session_id: "s-nothing" }),
      ],
      facts
    );
    expect(rows).toEqual([
      v("checkout"),
      { kind: "unattributed", reason: "no-binding" },
      { kind: "unattributed", reason: "declared-none" },
    ]);
  });

  it("puts rows with no value before work with no task, which ends the report", () => {
    const rows = values(
      "ticket",
      [
        call({ session_id: "s-none" }),
        call({ session_id: "s-nothing" }),
        call({ session_id: "s-bare" }),
      ],
      withDeclarations(declaration("s-none", null), declaration("s-bare", "b"))
    );
    expect(rows).toEqual([
      { kind: "absent" },
      { kind: "unattributed", reason: "no-binding" },
      { kind: "unattributed", reason: "declared-none" },
    ]);
  });

  it("splits by ticket, with the task that has none apart from the work that has no task", () => {
    const facts = withDeclarations(declaration("s-ticket", "a", "T-1"), declaration("s-bare", "b"));
    const rows = values(
      "ticket",
      [
        call({ session_id: "s-ticket" }),
        call({ session_id: "s-bare" }),
        call({ session_id: "s-x" }),
      ],
      facts
    );
    expect(rows).toEqual([
      v("T-1"),
      { kind: "absent" },
      { kind: "unattributed", reason: "no-binding" },
    ]);
  });

  it("attributes through the branch's declaration from the snapshots", () => {
    const facts: AttributionFacts = {
      ...noFacts,
      branches: new Map([
        [
          snapshotKey("repo-a", "feat/x"),
          [
            {
              repository_id: "repo-a",
              branch: "feat/x",
              task: "from-branch",
              ticket: null,
              declared_at: "2026-10-05T00:00:00.000Z",
              none: false,
              branch_created_at: null,
              snapshot_at: "2026-10-05T00:00:00.000Z",
            },
          ],
        ],
      ]),
    };
    expect(values("task", [call({ git_branch: "feat/x" })], facts)).toEqual([v("from-branch")]);
  });

  it("has an answer for every axis it names", () => {
    for (const axis of REPORT_AXES) {
      expect(buildReport([call()], noFacts, null, axis).totals.records).toBe(1);
    }
  });
});
