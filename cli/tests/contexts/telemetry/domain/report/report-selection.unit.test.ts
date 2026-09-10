import { describe, expect, it } from "vitest";
import type {
  CostReportInput,
  CostReportSessionJournal,
} from "../../../../../src/contexts/telemetry/domain/cost-report.js";
import {
  activeFilters,
  emptySelectionOf,
  selectionStages,
  taskMembership,
} from "../../../../../src/contexts/telemetry/domain/report/report-selection.js";
import type { TelemetrySinkRecord } from "../../../../../src/contexts/telemetry/domain/telemetry-sink-record.js";

const TASK = "2026_08/widgets";
const OTHER_TASK = "2026_08/gadgets";
const IN_TASK = {
  startMs: Date.parse("2026-08-17T09:00:00Z"),
  endMs: Date.parse("2026-08-17T10:00:00Z"),
};

function record(overrides: Partial<TelemetrySinkRecord>): TelemetrySinkRecord {
  return {
    sink_schema_version: 2,
    kind: "request",
    provenance: "local-read",
    tool: "claude",
    vendor_id: "s-1",
    vendor_field: "sessionId",
    step_attribution: "unattributed",
    event_timestamp: "2026-08-17T09:30:00Z",
    ...overrides,
  };
}

function journal(overrides: Partial<CostReportSessionJournal>): CostReportSessionJournal {
  return {
    vendorId: "s-1",
    tool: "claude",
    writtenPaths: [],
    taskIntervals: [],
    flowIntervals: [],
    ...overrides,
  };
}

function input(overrides: Partial<CostReportInput>): CostReportInput {
  return {
    fromDay: "2026-08-17",
    toDay: "2026-08-17",
    records: [],
    journals: [],
    declaredTools: [],
    undatedRecords: 0,
    unreadableLines: 0,
    measurementEnabled: true,
    ...overrides,
  };
}

describe("taskMembership", () => {
  it("keeps, per session, only the declared intervals naming the task asked for", () => {
    const forTask = { ...IN_TASK, path: `aidd_docs/tasks/${TASK}/plan.md` };
    const forOther = { ...IN_TASK, path: `aidd_docs/tasks/${OTHER_TASK}/plan.md` };

    const membership = taskMembership([journal({ taskIntervals: [forOther, forTask] })], TASK);

    expect([...membership.declaredIntervalsByVendorId]).toStrictEqual([["s-1", [forTask]]]);
  });

  it("gives a session that never declared the task no entry at all, rather than an empty one", () => {
    const forOther = { ...IN_TASK, path: `aidd_docs/tasks/${OTHER_TASK}/plan.md` };

    const membership = taskMembership([journal({ taskIntervals: [forOther] })], TASK);

    expect([...membership.declaredIntervalsByVendorId]).toStrictEqual([]);
  });
});

describe("selectionStages", () => {
  it("names the task stage after the task, carrying what the task kept", () => {
    const inside = record({ vendor_id: "s-1" });
    const outside = record({ vendor_id: "s-2" });
    const membership = taskMembership(
      [journal({ writtenPaths: [`aidd_docs/tasks/${TASK}/plan.md`] })],
      TASK
    );

    const stages = selectionStages([inside, outside], input({ task: TASK }), membership);

    expect(stages).toStrictEqual([
      { name: undefined, value: undefined, records: [inside, outside] },
      { name: "task", value: TASK, records: [inside] },
    ]);
  });
});

describe("emptySelectionOf", () => {
  it("answers nothing when every stage kept something", () => {
    const kept = record({ model: "opus" });
    const stages = selectionStages([kept], input({ filters: { model: "opus" } }), null);

    expect(emptySelectionOf(stages, input({ filters: { model: "opus" } }), null)).toBeUndefined();
  });

  it("knows a task that only a declared interval names", () => {
    const declared = { ...IN_TASK, path: `aidd_docs/tasks/${TASK}/plan.md` };
    const membership = taskMembership([journal({ taskIntervals: [declared] })], TASK);
    const outside = record({ event_timestamp: "2026-08-17T12:00:00Z" });
    const stages = selectionStages([outside], input({ task: TASK }), membership);

    expect(emptySelectionOf(stages, input({ task: TASK }), membership)).toStrictEqual({
      filter: "task",
      value: TASK,
      known: true,
    });
  });

  it("knows a task that only a written file names", () => {
    const membership = taskMembership(
      [journal({ vendorId: "s-9", writtenPaths: [`aidd_docs/tasks/${TASK}/plan.md`] })],
      TASK
    );
    const elsewhere = record({ vendor_id: "s-1" });
    const stages = selectionStages([elsewhere], input({ task: TASK }), membership);

    expect(emptySelectionOf(stages, input({ task: TASK }), membership)).toStrictEqual({
      filter: "task",
      value: TASK,
      known: true,
    });
  });

  it("reports a task no session ever declared or wrote into as one never known", () => {
    const membership = taskMembership([journal({})], TASK);
    const stages = selectionStages([record({})], input({ task: TASK }), membership);

    expect(emptySelectionOf(stages, input({ task: TASK }), membership)).toStrictEqual({
      filter: "task",
      value: TASK,
      known: false,
    });
  });

  it("knows a tool from the declared list, however many tools are declared beside it", () => {
    const declaredTools: CostReportInput["declaredTools"] = [
      {
        tool: "claude",
        coverage: "covered",
        capability: {
          localRead: null,
          export: null,
          journalAttributable: true,
          taskAttributable: true,
        },
      },
      {
        tool: "codex",
        coverage: "covered",
        capability: {
          localRead: null,
          export: null,
          journalAttributable: true,
          taskAttributable: true,
        },
      },
    ];
    const asked = input({ declaredTools, filters: { tool: "codex" } });
    const stages = selectionStages([record({ tool: "claude" })], asked, null);

    expect(emptySelectionOf(stages, asked, null)).toStrictEqual({
      filter: "tool",
      value: "codex",
      known: true,
    });
  });

  it("reports a tool outside the declared list as one never known", () => {
    const asked = input({ filters: { tool: "codex" } });
    const stages = selectionStages([record({ tool: "claude" })], asked, null);

    expect(emptySelectionOf(stages, asked, null)).toStrictEqual({
      filter: "tool",
      value: "codex",
      known: false,
    });
  });

  it("knows a model seen anywhere the caller looked, even outside this period", () => {
    const asked = input({
      filters: { model: "opus" },
      knownValues: { projects: new Set(), steps: new Set(), models: new Set(["opus"]) },
    });
    const stages = selectionStages([record({ model: "haiku" })], asked, null);

    expect(emptySelectionOf(stages, asked, null)).toStrictEqual({
      filter: "model",
      value: "opus",
      known: true,
    });
  });

  it("blames the combination when the culprit's value matched the period before other filters ran", () => {
    const asked = input({
      filters: { project: "acme", model: "opus" },
      knownValues: { projects: new Set(["acme"]), steps: new Set(), models: new Set(["opus"]) },
    });
    const acmeOnHaiku = record({ project_id: "acme", model: "haiku" });
    const otherOnOpus = record({ project_id: "other", model: "opus" });
    const stages = selectionStages([acmeOnHaiku, otherOnOpus], asked, null);

    expect(emptySelectionOf(stages, asked, null)).toStrictEqual({
      filter: "model",
      value: "opus",
      known: true,
      combination: true,
    });
  });

  it("measures a combination against the task's own records, not the whole period, under --task", () => {
    const membership = taskMembership(
      [journal({ vendorId: "s-1", writtenPaths: [`aidd_docs/tasks/${TASK}/plan.md`] })],
      TASK
    );
    const asked = input({
      task: TASK,
      filters: { model: "opus" },
      knownValues: { projects: new Set(), steps: new Set(), models: new Set(["opus"]) },
    });
    const inTaskOnHaiku = record({ vendor_id: "s-1", model: "haiku" });
    const outsideOnOpus = record({ vendor_id: "s-2", model: "opus" });
    const stages = selectionStages([inTaskOnHaiku, outsideOnOpus], asked, membership);

    expect(emptySelectionOf(stages, asked, membership)).toStrictEqual({
      filter: "model",
      value: "opus",
      known: true,
    });
  });

  it("never blames a combination on the task filter itself", () => {
    const membership = taskMembership([journal({})], TASK);
    const stages = selectionStages([record({})], input({ task: TASK }), membership);

    expect(emptySelectionOf(stages, input({ task: TASK }), membership)).not.toHaveProperty(
      "combination"
    );
  });
});

describe("activeFilters", () => {
  it("answers nothing for an empty filters object", () => {
    expect(activeFilters({})).toBeUndefined();
  });

  it("answers nothing when every filter is present but undefined", () => {
    expect(activeFilters({ project: undefined, model: undefined })).toBeUndefined();
  });

  it("keeps only the filters given, in the fixed order project, step, model, tool", () => {
    expect(activeFilters({ tool: "claude", project: "acme" })).toStrictEqual({
      project: "acme",
      tool: "claude",
    });
  });
});
