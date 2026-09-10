import { describe, expect, it } from "vitest";
import { TotalsAccumulator } from "../../../../../../src/contexts/telemetry/domain/cost-report.js";
import {
  type AgentKey,
  agentRows,
  modelKeyOf,
  modelRows,
  type PromptGroup,
  projectRows,
  promptRows,
} from "../../../../../../src/contexts/telemetry/domain/report/axes/record-stated-rows.js";
import type { TelemetrySinkRecord } from "../../../../../../src/contexts/telemetry/domain/telemetry-sink-record.js";

const BASE: TelemetrySinkRecord = {
  sink_schema_version: 2,
  kind: "request",
  provenance: "local-read",
  tool: "claude",
  vendor_id: "s-1",
  vendor_field: "sessionId",
  step_attribution: "unattributed",
};

function totalsOf(costUsd: number): TotalsAccumulator {
  const accumulator = new TotalsAccumulator();
  accumulator.add({ ...BASE, cost_usd: costUsd });
  return accumulator;
}

describe("modelKeyOf", () => {
  it("keys a record naming no model on a symbol, never on undefined", () => {
    expect(typeof modelKeyOf(BASE)).toBe("symbol");
  });
});

describe("a tie between two rows of equal size", () => {
  it("is broken on the project name", () => {
    const rows = projectRows(
      new Map([
        ["proj-b", totalsOf(1)],
        ["proj-a", totalsOf(1)],
      ])
    );

    expect(rows.map((row) => row.project)).toStrictEqual(["proj-a", "proj-b"]);
  });

  it("is broken on the agent name", () => {
    const rows = agentRows(
      new Map<AgentKey, TotalsAccumulator>([
        ["Plan", totalsOf(1)],
        ["Explore", totalsOf(1)],
      ])
    );

    expect(rows.map((row) => row.agent)).toStrictEqual(["Explore", "Plan"]);
  });

  it("is broken on the prompt id", () => {
    const rows = promptRows(
      new Map<string, PromptGroup>([
        ["p-b", { totals: totalsOf(1) }],
        ["p-a", { totals: totalsOf(1) }],
      ])
    );

    expect(rows.map((row) => row.prompt)).toStrictEqual(["p-a", "p-b"]);
  });

  it("is broken on the model name", () => {
    const rows = modelRows(
      new Map([
        ["claude-sonnet-5", totalsOf(1)],
        ["claude-opus-5", totalsOf(1)],
      ])
    );

    expect(rows.map((row) => row.model)).toStrictEqual(["claude-opus-5", "claude-sonnet-5"]);
  });
});
