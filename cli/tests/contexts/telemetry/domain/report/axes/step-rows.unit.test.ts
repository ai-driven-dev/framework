import { describe, expect, it } from "vitest";
import { TotalsAccumulator } from "../../../../../../src/contexts/telemetry/domain/cost-report.js";
import {
  type StepGroup,
  stepRowKey,
  stepRows,
} from "../../../../../../src/contexts/telemetry/domain/report/axes/step-rows.js";
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

function group(overrides: Partial<StepGroup>): StepGroup {
  const totals = new TotalsAccumulator();
  totals.add({ ...BASE, cost_usd: 1 });
  return { attribution: "unattributed", totals, ...overrides };
}

describe("stepRowKey", () => {
  it("joins the attribution and the step with one space", () => {
    expect(stepRowKey({ ...BASE, step_attribution: "tool-stated", step: "aidd-dev:01-plan" })).toBe(
      "tool-stated aidd-dev:01-plan"
    );
  });

  it("leaves the step empty after the space when none was found", () => {
    expect(stepRowKey(BASE)).toBe("unattributed ");
  });
});

describe("stepRows", () => {
  it("carries no step key at all on the unattributed row", () => {
    expect(stepRows(new Map([["unattributed ", group({})]]))).toStrictEqual([
      { attribution: "unattributed", totals: { requests: 1, costMicroUsd: 1_000_000 } },
    ]);
  });

  it("breaks a tie between two steps on the step name", () => {
    const rows = stepRows(
      new Map([
        ["b", group({ attribution: "tool-stated", step: "aidd-dev:02-implement" })],
        ["a", group({ attribution: "tool-stated", step: "aidd-dev:01-plan" })],
      ])
    );

    expect(rows.map((row) => row.step)).toStrictEqual([
      "aidd-dev:01-plan",
      "aidd-dev:02-implement",
    ]);
  });
});
