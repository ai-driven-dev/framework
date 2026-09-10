import { describe, expect, it } from "vitest";
import {
  type CostReportSessionJournal,
  TotalsAccumulator,
} from "../../../../../../src/contexts/telemetry/domain/cost-report.js";
import type { FlowInterval } from "../../../../../../src/contexts/telemetry/domain/flow-attribution.js";
import {
  allFlowIntervalsByVendorId,
  type FlowRowKey,
  flowKeyOf,
  flowRows,
} from "../../../../../../src/contexts/telemetry/domain/report/axes/flow-rows.js";
import type { TelemetrySinkRecord } from "../../../../../../src/contexts/telemetry/domain/telemetry-sink-record.js";

function record(overrides: Partial<TelemetrySinkRecord> = {}): TelemetrySinkRecord {
  return {
    sink_schema_version: 2,
    kind: "request",
    provenance: "local-read",
    tool: "claude",
    vendor_id: "s-1",
    vendor_field: "sessionId",
    step_attribution: "unattributed",
    ...overrides,
  };
}

function totalsOf(costUsd: number): TotalsAccumulator {
  const accumulator = new TotalsAccumulator();
  accumulator.add(record({ cost_usd: costUsd }));
  return accumulator;
}

function sdlcRunAt(startedAt: string): FlowInterval {
  const startMs = Date.parse(startedAt);
  return {
    skill: "aidd-orchestrator:01-sdlc",
    startMs,
    endMs: startMs + 60_000,
    closedBy: "journal-end",
  };
}

describe("allFlowIntervalsByVendorId", () => {
  it("gives a session that opened no flow no entry at all", () => {
    const journal: CostReportSessionJournal = {
      vendorId: "s-1",
      tool: "claude",
      writtenPaths: [],
      taskIntervals: [],
      flowIntervals: [],
    };

    expect(allFlowIntervalsByVendorId([journal])).toStrictEqual(new Map());
  });
});

describe("flowKeyOf, for a record no interval covers", () => {
  const outside = flowKeyOf(record(), new Map());

  it("keys a tool-stated step that orchestrates nothing on the outside-every-flow row", () => {
    const key = flowKeyOf(
      record({ step_attribution: "tool-stated", step: "aidd-dev:01-plan" }),
      new Map()
    );

    expect(typeof key).toBe("symbol");
    expect(key).toBe(outside);
  });

  it("keys a tool-stated orchestrating step on the skill's own name", () => {
    const key = flowKeyOf(
      record({ step_attribution: "tool-stated", step: "aidd-orchestrator:01-sdlc" }),
      new Map()
    );

    expect(key).toBe("aidd-orchestrator:01-sdlc");
  });
});

describe("flowRows", () => {
  it("breaks a tie between two runs of one skill on the moment each started", () => {
    const flows = new Map<FlowRowKey, TotalsAccumulator>([
      [sdlcRunAt("2026-08-18T11:00:00Z"), totalsOf(1)],
      [sdlcRunAt("2026-08-18T10:00:00Z"), totalsOf(1)],
    ]);

    expect(flowRows(flows).map((row) => row.startedAt)).toStrictEqual([
      "2026-08-18T10:00:00Z",
      "2026-08-18T11:00:00Z",
    ]);
  });
});
