import type { ReportUsageResult } from "../../../src/contexts/telemetry/application/report/report-usage.js";
import type { RequestReportResult } from "../../../src/contexts/telemetry/application/report/request-report.js";
import type { Period } from "../../../src/contexts/telemetry/contract/period.js";
import {
  NO_FILTERS,
  type ReportFilters,
} from "../../../src/contexts/telemetry/contract/report-filter.js";
import type {
  AxisValue,
  ReportAxis,
  Tally,
} from "../../../src/contexts/telemetry/contract/usage-report.js";
import { selectorsOf } from "../../../src/contexts/telemetry/domain/report/report-filter.js";
import { printUsageReport } from "../../../src/presentation/display/telemetry/telemetry-report-display.js";
import { CapturingOutput } from "./capturing-output.fake.js";

export const sum = (known: number, unknownRecords = 0) => ({ known, unknownRecords });
/** `unknown` calls of `records` did not report their cache read. */
export const tally = (
  records: number,
  parts: [number, number, number, number],
  unknown = 0
): Tally => ({
  records,
  counters: {
    input: sum(parts[0]),
    output: sum(parts[1]),
    cache_read: sum(parts[2], unknown),
    cache_write: sum(parts[3]),
  },
  total: sum(parts[0] + parts[1] + parts[2] + parts[3], unknown),
});
export const NOT_STORED = {
  "outside-repo": 0,
  "never-seen-alive": 0,
  "no-consent": 0,
  "consent-closed": 0,
  "unreadable-consent": 0,
  "no-cwd": 0,
  undated: 0,
};
type Reported = Extract<ReportUsageResult, { status: "reported" }>;
/** What the figures rest on and what the read found, given flat: `result` splits them. */
type Coverage = Reported["coverage"] & Reported["run"];
export const COVERAGE: Coverage = {
  filesRead: 2,
  records: 3,
  unrecognised: 0,
  notStored: NOT_STORED,
  consentLogDamaged: false,
  oldestTranscriptAt: "2026-09-20T08:00:00.000Z",
  skippedLedgerLines: 0,
  leftOut: { undated: 0, unrecognised: 0, requestless: 0 },
};
export const BOTH: Period = { from: "2026-10-01", to: "2026-10-07" };

export function result(
  axis: ReportAxis,
  rows: [AxisValue, Tally][],
  totals: Tally,
  coverage: Partial<Coverage> = {},
  period: Period = BOTH,
  filters: ReportFilters = NO_FILTERS
): RequestReportResult {
  return {
    status: "reported",
    period,
    filters,
    selected: selectorsOf(filters),
    report: { axis, rows: rows.map(([value, t]) => ({ value, ...t })), totals },
    ...split({ ...COVERAGE, ...coverage }),
  };
}
export function split({ records, leftOut, ...run }: Coverage): Pick<Reported, "coverage" | "run"> {
  return { coverage: { records, leftOut }, run };
}
export const printed = (r: RequestReportResult): string[] => {
  const output = new CapturingOutput(false);
  printUsageReport(output, r);
  return output.lines;
};
export const value = (text: string): AxisValue => ({ kind: "value", value: text });
export const one = tally(1, [1, 10, 1000, 100]);
