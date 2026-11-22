import { type Command, InvalidArgumentError, Option } from "commander";
import type { RequestReportResult } from "../../../contexts/telemetry/application/report/request-report.use-case.js";
import {
  REFUSED_ENVELOPE,
  reportEnvelopeOf,
} from "../../../contexts/telemetry/contract/report-envelope.js";
import {
  ABSENT_AXES,
  type ReportFilters,
  UNATTRIBUTED_SELECTORS,
} from "../../../contexts/telemetry/contract/report-filter.js";
import { USAGE_AGENTS, USAGE_TOOLS } from "../../../contexts/telemetry/contract/usage-record.js";
import { REPORT_AXES, type ReportAxis } from "../../../contexts/telemetry/contract/usage-report.js";
import type { TelemetryRequests } from "../../../orchestration/deps.js";
import type { Output } from "../../../orchestration/domain/output.js";
import { printUsageReport } from "../../presenters/telemetry/telemetry-report.presenter.js";
import { commandOf, type TelemetrySurface } from "./telemetry-surface.controller.js";

type ReportCommandOptions = {
  from?: string;
  to?: string;
  days?: string;
  axis: ReportAxis;
  json: boolean;
} & Partial<ReportFilters>;

/** One value per flag, checked by the request. Commander keeps the last of a repeated flag
 * silently, and its own `choices` replaces any parser, so both are checked here. A repeat is
 * refused by the flag's name: a bare flag's value is its preset, not what was typed. Its help
 * says what it keeps: "Only the " then `kept`. */
function filterOptionOf(command: Command, requests: TelemetryRequests) {
  return (flags: string, kept: string, choices?: readonly string[]): Option => {
    const option = new Option(flags, `Only the ${kept}`);
    return (choices === undefined ? option : option.choices(choices)).argParser(
      (value: string, previous: string | undefined): string => {
        if (previous !== undefined) {
          command.error(`error: ${option.long} is given twice: give it once.`);
        }
        const checked = requests.checkFilterValue.execute({ value, choices });
        if (checked.status === "refused") throw new InvalidArgumentError(checked.reason);
        return checked.text;
      }
    );
  };
}

/** One narrowing flag: its text, what it keeps, and the values it accepts when they are a closed set. */
interface FilterFlag {
  readonly flags: string;
  readonly kept: string;
  readonly choices?: readonly string[];
}

const FILTER_FLAGS: readonly FilterFlag[] = [
  { flags: "--task <name>", kept: "calls of this task" },
  { flags: "--ticket <ref>", kept: "calls of this ticket, as declared" },
  { flags: "--person <id>", kept: "calls of this identity" },
  { flags: "--model <id>", kept: "calls of this model" },
  { flags: "--agent <agent>", kept: "calls of this agent", choices: USAGE_AGENTS },
  { flags: "--session <id>", kept: "calls of this session, or a start of its id" },
  {
    flags: "--repository <id>",
    kept: "calls of this repository, a start of its id, or . for the one here",
  },
  { flags: "--tool <tool>", kept: "calls of this tool", choices: USAGE_TOOLS },
  { flags: "--absent <axis>", kept: "calls with no value on this axis", choices: ABSENT_AXES },
];

function declareReportOptions(report: Command, requests: TelemetryRequests): Command {
  const filter = filterOptionOf(report, requests);
  report
    .description("Show what the work consumed, split along one axis, after reading new transcripts")
    .option("--from <date>", "First day to include, as YYYY-MM-DD (UTC)")
    .option("--to <date>", "Last day to include, as YYYY-MM-DD (UTC)")
    .option("--days <n>", "The last n days, today included")
    .addOption(
      new Option("--axis <axis>", "What to split by").choices(REPORT_AXES).default("total")
    );
  for (const { flags, kept, choices } of FILTER_FLAGS)
    report.addOption(filter(flags, kept, choices));
  return report
    .addOption(
      filter(
        "--unattributed [reason]",
        "work with no task, for this reason",
        UNATTRIBUTED_SELECTORS
      ).preset("any")
    )
    .option("--json", "Print a versioned JSON envelope instead of text", false);
}

/** The outcomes that end the run with a failure after saying why. */
const FAILED_REPORT = new Set<string>(["conflicting", "not-a-repository", "ambiguous"]);

type FailedReport = Extract<
  RequestReportResult,
  { status: "conflicting" | "not-a-repository" | "ambiguous" }
>;

function isFailedReport(result: RequestReportResult): result is FailedReport {
  return FAILED_REPORT.has(result.status);
}

function printReportOutcome(output: Output, result: RequestReportResult, json: boolean): void {
  if (isFailedReport(result)) {
    printUsageReport(output, result);
    output.exit(1);
  } else if (!json) {
    printUsageReport(output, result);
  } else {
    const envelope = result.status === "refused" ? REFUSED_ENVELOPE : reportEnvelopeOf(result);
    output.print(JSON.stringify(envelope, null, 2));
  }
}

export function configureReport(
  command: Command,
  { program, createDeps, requests }: TelemetrySurface
): void {
  declareReportOptions(command, requests).action(async (cmdOptions: ReportCommandOptions) => {
    const { output, projectRoot, runChecked } = commandOf(program, createDeps);
    await runChecked(
      () =>
        requests.parseReportFlags.execute({
          axis: cmdOptions.axis,
          from: cmdOptions.from,
          to: cmdOptions.to,
          days: cmdOptions.days,
          filters: cmdOptions,
          cwd: projectRoot,
        }),
      async (deps, { request }) =>
        printReportOutcome(
          output,
          await deps.telemetry.requestReport.execute(request),
          cmdOptions.json
        )
    );
  });
}
