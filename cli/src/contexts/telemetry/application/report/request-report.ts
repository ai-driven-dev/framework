import type { Selector } from "../../contract/report-filter.js";
import type { ReportAxis } from "../../contract/usage-report.js";
import { selectorsOf } from "../../domain/report/report-filter.js";
import type { ReportUsage, ReportUsageCommand, ReportUsageResult } from "./report-usage.js";

/** A report, and for a reported one what each filter given selects, as a row of its axis. */
export type RequestReportResult =
  | Exclude<ReportUsageResult, { status: "reported" }>
  | (Extract<ReportUsageResult, { status: "reported" }> & {
      readonly selected: readonly (readonly [ReportAxis, Selector])[];
    });

/** The report a person asked for, with what each of its filters selects. */
export class RequestReport {
  constructor(private readonly report: Pick<ReportUsage, "execute">) {}

  async execute(request: ReportUsageCommand): Promise<RequestReportResult> {
    const result = await this.report.execute(request);
    return result.status === "reported"
      ? { ...result, selected: selectorsOf(result.filters) }
      : result;
  }
}
