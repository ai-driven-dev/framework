import { describe, expect, it } from "vitest";
import type { CostReportToolDeclaration } from "../../../../../../src/contexts/telemetry/domain/cost-report.js";
import { buildToolRows } from "../../../../../../src/contexts/telemetry/domain/report/axes/tool-rows.js";

const COVERED: CostReportToolDeclaration = {
  tool: "claude",
  coverage: "covered",
  capability: {
    localRead: null,
    export: null,
    journalAttributable: false,
    taskAttributable: false,
  },
};

describe("buildToolRows", () => {
  it("carries no reason key at all for a tool that declared none", () => {
    expect(buildToolRows([COVERED], new Map(), new Map())).toStrictEqual([
      {
        tool: "claude",
        coverage: "covered",
        capability: COVERED.capability,
        totals: { requests: 0 },
      },
    ]);
  });
});
