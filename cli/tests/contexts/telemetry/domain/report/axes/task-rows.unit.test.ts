import { describe, expect, it } from "vitest";
import {
  type CostReportSessionJournal,
  TotalsAccumulator,
} from "../../../../../../src/contexts/telemetry/domain/cost-report.js";
import {
  backlogKeyOf,
  backlogRows,
  type TaskGroup,
  taskRowKeyOf,
  taskRowOf,
  taskRows,
} from "../../../../../../src/contexts/telemetry/domain/report/axes/task-rows.js";
import type { TaskBacklogDeclaration } from "../../../../../../src/contexts/telemetry/domain/task-backlog-link.js";
import type { TelemetrySinkRecord } from "../../../../../../src/contexts/telemetry/domain/telemetry-sink-record.js";

const FROM_MS = Date.parse("2026-08-18T10:00:00Z");
const TO_MS = Date.parse("2026-08-18T11:00:00Z");
const TASK_PATH = "aidd_docs/tasks/2026_08/refactor-sink/plan.md";
const TASK = "2026_08/refactor-sink";

function record(overrides: Partial<TelemetrySinkRecord> = {}): TelemetrySinkRecord {
  return {
    sink_schema_version: 2,
    kind: "request",
    provenance: "local-read",
    tool: "claude",
    vendor_id: "s-1",
    vendor_field: "sessionId",
    step_attribution: "unattributed",
    event_timestamp: "2026-08-18T10:30:00Z",
    ...overrides,
  };
}

function journal(overrides: Partial<CostReportSessionJournal> = {}): CostReportSessionJournal {
  return {
    vendorId: "s-1",
    tool: "claude",
    writtenPaths: [TASK_PATH],
    taskIntervals: [],
    flowIntervals: [],
    witnessed: { fromMs: FROM_MS, toMs: TO_MS },
    ...overrides,
  };
}

function totalsOf(costUsd: number): TotalsAccumulator {
  const accumulator = new TotalsAccumulator();
  accumulator.add(record({ cost_usd: costUsd }));
  return accumulator;
}

function rowOf(target: TelemetrySinkRecord, sessionJournal: CostReportSessionJournal | undefined) {
  return taskRowOf(
    target,
    new Map([["s-1", sessionJournal?.taskIntervals ?? []]]),
    new Map(sessionJournal === undefined ? [] : [["s-1", sessionJournal]])
  );
}

describe("taskRowKeyOf", () => {
  it("joins the attribution and the task with one space", () => {
    expect(taskRowKeyOf({ task: TASK, attribution: "declared" })).toBe(`declared ${TASK}`);
  });

  it("keeps a reason as its own key", () => {
    expect(taskRowKeyOf("journal-silent")).toBe("journal-silent");
  });
});

describe("taskRowOf, when the intervals were read but no journal reached the session", () => {
  it("answers no-declaration rather than throwing", () => {
    expect(rowOf(record(), undefined)).toBe("no-declaration");
  });
});

describe("taskRowOf, inferring from a session's sole written task", () => {
  it("infers at the first moment the journal witnessed", () => {
    const row = rowOf(record({ event_timestamp: "2026-08-18T10:00:00Z" }), journal());

    expect(row).toStrictEqual({ task: TASK, attribution: "inferred" });
  });

  it("infers at the last moment the journal witnessed", () => {
    const row = rowOf(record({ event_timestamp: "2026-08-18T11:00:00Z" }), journal());

    expect(row).toStrictEqual({ task: TASK, attribution: "inferred" });
  });

  it("infers nothing one second after the last witnessed moment", () => {
    expect(rowOf(record({ event_timestamp: "2026-08-18T11:00:01Z" }), journal())).toBe(
      "no-declaration"
    );
  });

  it("infers nothing one second before the first witnessed moment", () => {
    expect(rowOf(record({ event_timestamp: "2026-08-18T09:59:59Z" }), journal())).toBe(
      "precedes-journal"
    );
  });

  it("infers nothing from a journal that witnessed no readable moment", () => {
    expect(rowOf(record(), journal({ witnessed: undefined }))).toBe("no-declaration");
  });

  it("infers nothing for a record whose own moment does not parse", () => {
    expect(rowOf(record({ event_timestamp: "not a moment" }), journal())).toBe("no-declaration");
  });
});

describe("taskRows", () => {
  function group(overrides: Partial<TaskGroup>): TaskGroup {
    return { totals: totalsOf(1), ...overrides };
  }

  it("drops a named group missing its attribution", () => {
    expect(taskRows(new Map([["k", group({ task: TASK })]]))).toStrictEqual([]);
  });

  it("drops a named group missing its task", () => {
    expect(taskRows(new Map([["k", group({ attribution: "declared" })]]))).toStrictEqual([]);
  });

  it("breaks a tie between two tasks on the task name", () => {
    const rows = taskRows(
      new Map([
        ["b", group({ task: "2026_08/b", attribution: "declared" })],
        ["a", group({ task: "2026_08/a", attribution: "declared" })],
      ])
    );

    expect(rows.map((row) => row.task)).toStrictEqual(["2026_08/a", "2026_08/b"]);
  });

  it("breaks a tie between one task's two attributions on the attribution", () => {
    const rows = taskRows(
      new Map([
        ["i", group({ task: TASK, attribution: "inferred" })],
        ["d", group({ task: TASK, attribution: "declared" })],
      ])
    );

    expect(rows.map((row) => row.attribution)).toStrictEqual(["declared", "inferred"]);
  });
});

describe("backlogRows", () => {
  const noneDeclared = backlogKeyOf({ task: TASK, attribution: "declared" }, undefined);
  const unreadable = backlogKeyOf(
    { task: TASK, attribution: "declared" },
    new Map<string, TaskBacklogDeclaration>([[TASK, { kind: "unreadable" }]])
  );

  it("names a declared item as its own row, never as a reason", () => {
    expect(backlogRows(new Map([["ISSUE-7", totalsOf(1)]]))).toStrictEqual([
      { backlog: "ISSUE-7", totals: { requests: 1, costMicroUsd: 1_000_000 } },
    ]);
  });

  it("keeps the no-declaration and unreadable rows after the named ones", () => {
    const rows = backlogRows(
      new Map([
        [noneDeclared, totalsOf(3)],
        [unreadable, totalsOf(2)],
        ["ISSUE-7", totalsOf(1)],
      ])
    );

    expect(rows).toStrictEqual([
      { backlog: "ISSUE-7", totals: { requests: 1, costMicroUsd: 1_000_000 } },
      { declaration: "none", totals: { requests: 1, costMicroUsd: 3_000_000 } },
      { declaration: "unreadable", totals: { requests: 1, costMicroUsd: 2_000_000 } },
    ]);
  });

  it("orders two named items largest first", () => {
    const rows = backlogRows(
      new Map([
        ["ISSUE-1", totalsOf(1)],
        ["ISSUE-2", totalsOf(2)],
      ])
    );

    expect(rows.map((row) => row.backlog)).toStrictEqual(["ISSUE-2", "ISSUE-1"]);
  });

  it("breaks a tie between two named items on the item", () => {
    const rows = backlogRows(
      new Map([
        ["ISSUE-2", totalsOf(1)],
        ["ISSUE-1", totalsOf(1)],
      ])
    );

    expect(rows.map((row) => row.backlog)).toStrictEqual(["ISSUE-1", "ISSUE-2"]);
  });
});
