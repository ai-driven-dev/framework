import { describe, expect, it } from "vitest";
import type {
  ReportUsageRequest,
  ReportUsageResult,
} from "../../../../../src/contexts/telemetry/application/report/report-usage.use-case.js";
import { RequestReport } from "../../../../../src/contexts/telemetry/application/report/request-report.use-case.js";
import { filtersOf } from "../../../../../src/contexts/telemetry/contract/report-filter.js";
import { buildReport } from "../../../../../src/contexts/telemetry/domain/report/usage-report.js";
import { NOT_STORED } from "../../testing/ingest-usage-setup.builder.js";

const COMMAND: ReportUsageRequest = { axis: "day", period: { from: null, to: null } };

const REPORTED: ReportUsageResult = {
  status: "reported",
  period: { from: null, to: null },
  filters: filtersOf({ model: "opus" }),
  report: buildReport({
    records: [],
    facts: { declarations: [], carries: [], branches: new Map() },
    person: null,
    axis: "day",
  }),
  coverage: { records: 0, leftOut: { undated: 0, unrecognised: 0, requestless: 0 } },
  run: {
    filesRead: 0,
    unrecognised: 0,
    notStored: NOT_STORED,
    consentLogDamaged: false,
    oldestTranscriptAt: null,
    unreadable: [],
    skippedLedgerLines: 0,
  },
};

const asking = (result: ReportUsageResult) =>
  new RequestReport({ execute: async () => result }).execute(COMMAND);

describe("requesting a report", () => {
  it("adds what each filter selects to a reported result", async () => {
    expect(await asking(REPORTED)).toMatchObject({
      status: "reported",
      selected: [["model", { kind: "value", value: "opus" }]],
    });
  });

  it("passes any other result through", async () => {
    expect(await asking({ status: "refused" })).toEqual({ status: "refused" });
  });
});
