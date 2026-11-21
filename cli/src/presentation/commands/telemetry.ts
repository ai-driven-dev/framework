import { type Command, InvalidArgumentError, Option } from "commander";
import {
  REFUSED_ENVELOPE,
  reportEnvelopeOf,
} from "../../contexts/telemetry/application/report/report-envelope.js";
import {
  ABSENT_AXES,
  type ReportFilters,
  UNATTRIBUTED_SELECTORS,
} from "../../contexts/telemetry/contract/report-filter.js";
import {
  DECLARED_BY,
  type DeclaredBy,
} from "../../contexts/telemetry/contract/task-declaration.js";
import { USAGE_AGENTS, USAGE_TOOLS } from "../../contexts/telemetry/contract/usage-record.js";
import { REPORT_AXES, type ReportAxis } from "../../contexts/telemetry/contract/usage-report.js";
import type { Deps, DepsSliceFactory, TelemetryRequests } from "../deps.js";
import {
  printForgetResult,
  printIdentityRule,
  printOffResult,
  printOnResult,
} from "../display/telemetry/telemetry-lifecycle-display.js";
import { printUsageReport } from "../display/telemetry/telemetry-report-display.js";
import {
  printDeclareResult,
  printIdentityResult,
  printIngestResult,
  printTelemetryStatus,
} from "../display/telemetry-display.js";
import { failCommand } from "../errors/error-translator.js";
import { IdentityOffWithIdentifierError } from "../presentation.error.js";
import { parseGlobalOptions } from "./global-options.js";

/** What this command reads of the graph. */
type TelemetryCommandKeys = "prompter" | "telemetry";

/** What every subcommand registrar needs to register itself on the `telemetry` command. */
interface TelemetrySurface {
  readonly telemetry: Command;
  readonly program: Command;
  readonly createDeps: DepsSliceFactory<TelemetryCommandKeys>;
  readonly requests: TelemetryRequests;
}

/** A command's output and directory, and how it runs: `run` wires the dependencies for some
 * work, `runChecked` first checks what the request alone can answer, before any are wired. Both
 * report any failure the one way. */
function commandOf(program: Command, createDeps: DepsSliceFactory<TelemetryCommandKeys>) {
  const { verbose, output, projectRoot } = parseGlobalOptions(program);
  const attempt = async (body: () => Promise<void>): Promise<void> => {
    try {
      await body();
    } catch (error) {
      failCommand(output, error);
    }
  };
  const wire = () => createDeps(projectRoot, { verbose }, output);
  const run = (work: (deps: Pick<Deps, TelemetryCommandKeys>) => Promise<void>) =>
    attempt(async () => work(await wire()));
  const runChecked = <Checked>(
    validate: () => Checked,
    work: (deps: Pick<Deps, TelemetryCommandKeys>, checked: Checked) => Promise<void>
  ) =>
    attempt(async () => {
      const checked = validate();
      await work(await wire(), checked);
    });
  return { output, projectRoot, run, runChecked };
}

interface OnOptions {
  readonly yes: boolean;
  readonly as?: string;
  readonly anonymous: boolean;
}

function registerOn({ telemetry, program, createDeps, requests }: TelemetrySurface): void {
  telemetry
    .command("on")
    .description("Measure this clone")
    .option("--yes", "Do not ask first", false)
    .option("--as <id>", "Name you by this identifier on your own measurement")
    .option("--anonymous", "Name nobody on your own measurement", false)
    .action(async (cmdOptions: OnOptions) => {
      const { output, projectRoot, runChecked } = commandOf(program, createDeps);
      await runChecked(
        () =>
          requests.checkOnRequest.execute({
            ...cmdOptions,
            interactive: process.stdout.isTTY === true,
          }),
        async (deps) => {
          const confirmed =
            cmdOptions.yes ||
            (await deps.prompter.confirm("Measure what this clone consumes?", false));
          if (!confirmed) {
            output.info("Nothing changed.");
            return;
          }
          const choice = await deps.telemetry.chooseIdentity.execute({
            ...cmdOptions,
            cwd: projectRoot,
            onRefused: () => printIdentityRule(output),
          });
          const result = await deps.telemetry.enableTelemetry.execute({ cwd: projectRoot, choice });
          const retention =
            result.status === "on"
              ? await deps.telemetry.readTranscriptRetention.execute({ root: result.root })
              : undefined;
          printOnResult(output, result, retention);
          if (result.status === "refused") output.exit(1);
        }
      );
    });
}

function registerOff({ telemetry, program, createDeps }: TelemetrySurface): void {
  telemetry
    .command("off")
    .description("Stop measuring this clone; what was measured stays")
    .action(async () => {
      const { output, projectRoot, run } = commandOf(program, createDeps);
      await run(async (deps) => {
        const result = await deps.telemetry.disableTelemetry.execute({ cwd: projectRoot });
        printOffResult(output, result);
        if (result.status === "refused") output.exit(1);
      });
    });
}

function registerForget({ telemetry, program, createDeps }: TelemetrySurface): void {
  telemetry
    .command("forget")
    .description("Show everything measurement keeps on this machine, or remove it with --yes")
    .option("--yes", "Remove it, instead of only showing it", false)
    .action(async (cmdOptions: { yes: boolean }) => {
      const { output, run } = commandOf(program, createDeps);
      await run(async (deps) => {
        printForgetResult(
          output,
          await deps.telemetry.forgetTelemetry.execute({ confirmed: cmdOptions.yes })
        );
      });
    });
}

function registerIngest({ telemetry, program, createDeps }: TelemetrySurface): void {
  telemetry
    .command("ingest")
    .description("Read new transcripts into the local ledger, for clones that opted in")
    .option("--quiet", "Print nothing on success (for hooks)", false)
    .action(async (cmdOptions: { quiet: boolean }) => {
      const { output, run } = commandOf(program, createDeps);
      await run(async (deps) => {
        const result = await deps.telemetry.ingestUsage.execute();
        if (!cmdOptions.quiet) printIngestResult(output, result);
      });
    });
}

function registerTask({ telemetry, program, createDeps, requests }: TelemetrySurface): void {
  telemetry
    .command("task [name]")
    .description("Declare the task the current work belongs to")
    .option("--ticket <ref>", "The ticket the task belongs to, kept as typed")
    .option("--none", "Declare that this work has no task", false)
    .addOption(
      new Option("--by <by>", "Who declares (hooks only)")
        .choices(DECLARED_BY)
        .default("command")
        .hideHelp()
    )
    .action(
      async (
        name: string | undefined,
        cmdOptions: { ticket?: string; none: boolean; by: DeclaredBy }
      ) => {
        const { output, projectRoot, runChecked } = commandOf(program, createDeps);
        await runChecked(
          () =>
            requests.resolveTaskRequest.execute({
              name,
              ticket: cmdOptions.ticket,
              none: cmdOptions.none,
            }),
          async (deps, { request }) => {
            const result = await deps.telemetry.declareTask.execute({
              cwd: projectRoot,
              request,
              by: cmdOptions.by,
            });
            printDeclareResult(output, result);
            if (result.status === "refused") output.exit(1);
          }
        );
      }
    );
}

function registerStatus({ telemetry, program, createDeps }: TelemetrySurface): void {
  telemetry
    .command("status")
    .description("Show if this clone is measured, since when, and its task")
    .action(async () => {
      const { output, projectRoot, run } = commandOf(program, createDeps);
      await run(async (deps) => {
        printTelemetryStatus(
          output,
          await deps.telemetry.readTelemetryStatus.execute({ cwd: projectRoot })
        );
      });
    });
}

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

function declareReportOptions(report: Command, requests: TelemetryRequests): Command {
  const filter = filterOptionOf(report, requests);
  return report
    .description("Show what the work consumed, split along one axis, after reading new transcripts")
    .option("--from <date>", "First day to include, as YYYY-MM-DD (UTC)")
    .option("--to <date>", "Last day to include, as YYYY-MM-DD (UTC)")
    .option("--days <n>", "The last n days, today included")
    .addOption(
      new Option("--axis <axis>", "What to split by").choices(REPORT_AXES).default("total")
    )
    .addOption(filter("--task <name>", "calls of this task"))
    .addOption(filter("--ticket <ref>", "calls of this ticket, as declared"))
    .addOption(filter("--person <id>", "calls of this identity"))
    .addOption(filter("--model <id>", "calls of this model"))
    .addOption(filter("--agent <agent>", "calls of this agent", USAGE_AGENTS))
    .addOption(filter("--session <id>", "calls of this session, or a start of its id"))
    .addOption(
      filter(
        "--repository <id>",
        "calls of this repository, a start of its id, or . for the one here"
      )
    )
    .addOption(filter("--tool <tool>", "calls of this tool", USAGE_TOOLS))
    .addOption(filter("--absent <axis>", "calls with no value on this axis", ABSENT_AXES))
    .addOption(
      filter(
        "--unattributed [reason]",
        "work with no task, for this reason",
        UNATTRIBUTED_SELECTORS
      ).preset("any")
    )
    .option("--json", "Print a versioned JSON envelope instead of text", false);
}

function registerReport({ telemetry, program, createDeps, requests }: TelemetrySurface): void {
  declareReportOptions(telemetry.command("report"), requests).action(
    async (cmdOptions: ReportCommandOptions) => {
      const { output, projectRoot, runChecked } = commandOf(program, createDeps);
      await runChecked(
        () =>
          requests.resolveReportRequest.execute({
            axis: cmdOptions.axis,
            from: cmdOptions.from,
            to: cmdOptions.to,
            days: cmdOptions.days,
            filters: cmdOptions,
            cwd: projectRoot,
          }),
        async (deps, { request }) => {
          const result = await deps.telemetry.requestReport.execute(request);
          if (
            result.status === "conflicting" ||
            result.status === "not-a-repository" ||
            result.status === "ambiguous"
          ) {
            printUsageReport(output, result);
            return output.exit(1);
          }
          if (!cmdOptions.json) return printUsageReport(output, result);
          output.print(
            JSON.stringify(
              result.status === "refused" ? REFUSED_ENVELOPE : reportEnvelopeOf(result),
              null,
              2
            )
          );
        }
      );
    }
  );
}

function registerIdentity({ telemetry, program, createDeps }: TelemetrySurface): void {
  telemetry
    .command("identity [id]")
    .description("Choose to be named on your own measurement, or show or remove that choice")
    .option("--off", "Stop naming you and remove the identity", false)
    .action(async (id: string | undefined, cmdOptions: { off: boolean }) => {
      const { output, runChecked } = commandOf(program, createDeps);
      await runChecked(
        () => {
          if (cmdOptions.off && id !== undefined) throw new IdentityOffWithIdentifierError();
        },
        async (deps) => {
          const use = deps.telemetry.manageIdentity;
          const result = await use.execute(
            cmdOptions.off
              ? { action: "off" }
              : id === undefined
                ? { action: "show" }
                : { action: "set", typed: id }
          );
          printIdentityResult(output, result);
          if (result.status === "refused") output.exit(1);
        }
      );
    });
}

export function registerTelemetryCommand(
  program: Command,
  createDeps: DepsSliceFactory<TelemetryCommandKeys>,
  requests: TelemetryRequests
): void {
  const surface = {
    telemetry: program
      .command("telemetry")
      .description("Measure what Claude Code and Codex sessions consume, locally"),
    program,
    createDeps,
    requests,
  };
  registerOn(surface);
  registerOff(surface);
  registerForget(surface);
  registerIngest(surface);
  registerTask(surface);
  registerStatus(surface);
  registerReport(surface);
  registerIdentity(surface);
}
