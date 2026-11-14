import { InvalidReportPeriodError } from "../../../../shared/domain/errors.js";
import type { ReportFilters } from "../../contract/report-filter.js";
import type { ReportAxis } from "../../contract/usage-report.js";
import { periodOf } from "../../domain/report/period.js";
import { filtersOf } from "../../domain/report/report-filter.js";
import type { ReportUsageCommand } from "./report-usage.js";

export interface ResolveReportRequestCommand {
  readonly axis: ReportAxis;
  readonly from?: string;
  readonly to?: string;
  readonly days?: string;
  /** The filters as typed; `--repository .` is the directory `cwd`'s repository. */
  readonly filters: Partial<ReportFilters>;
  readonly cwd: string;
}

export interface ResolveReportRequestResult {
  readonly request: ReportUsageCommand;
}

/** What a person typed to ask for a report, as the report to ask for: the days it covers, and
 * the filters it keeps. A period that cannot be answered is refused. */
export class ResolveReportRequest {
  constructor(private readonly now: () => Date) {}

  execute(command: ResolveReportRequestCommand): ResolveReportRequestResult {
    const period = periodOf(command, this.now());
    if (!period.ok) throw new InvalidReportPeriodError(period.message);
    const given = filtersOf(command.filters);
    return {
      request: {
        axis: command.axis,
        period: period.period,
        filters:
          given.repository === "." ? { ...given, repository: null, here: command.cwd } : given,
      },
    };
  }
}
