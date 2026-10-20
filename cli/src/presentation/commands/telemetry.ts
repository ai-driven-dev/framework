import { type Command, InvalidArgumentError, Option } from "commander";
import {
  REFUSED_ENVELOPE,
  reportEnvelopeOf,
} from "../../contexts/telemetry/application/report/report-envelope.js";
import type { RequestedFilters } from "../../contexts/telemetry/application/report/report-usage-use-case.js";
import type { IdentityChoice } from "../../contexts/telemetry/application/switch/telemetry-on-use-case.js";
import {
  DECLARED_BY,
  type DeclaredBy,
  requestOf,
  textOrNull,
} from "../../contexts/telemetry/domain/declaration/task-declaration.js";
import { personIdOf } from "../../contexts/telemetry/domain/identity/person-identity.js";
import { periodOf } from "../../contexts/telemetry/domain/report/period.js";
import {
  ABSENT_AXES,
  filtersOf,
  type ReportFilters,
  UNATTRIBUTED_SELECTORS,
} from "../../contexts/telemetry/domain/report/report-filter.js";
import {
  REPORT_AXES,
  type ReportAxis,
} from "../../contexts/telemetry/domain/report/usage-report.js";
import { USAGE_AGENTS, USAGE_TOOLS } from "../../contexts/telemetry/domain/usage-record.js";
import type { Prompter } from "../../kernel/ports/prompter.js";
import { createDeps } from "../../runtime/wiring/framework.js";
import type { TelemetryDeps } from "../../runtime/wiring/telemetry.js";
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
import { ErrorHandler } from "../error-handler.js";
import type { CLIOutput } from "../output.js";
import { parseGlobalOptions } from "./global-options.js";

/** A command's output and directory, and `run`, which wires its dependencies for some work
 * and reports any failure the one way. */
function commandOf(program: Command) {
  const { verbose, output, projectRoot } = parseGlobalOptions(program);
  const run = async (
    work: (deps: Awaited<ReturnType<typeof createDeps>>) => Promise<void>
  ): Promise<void> => {
    try {
      await work(await createDeps(projectRoot, { verbose }, output));
    } catch (error) {
      new ErrorHandler(output).handle(error);
    }
  };
  return { output, projectRoot, run };
}

interface OnOptions {
  readonly yes: boolean;
  readonly as?: string;
  readonly anonymous: boolean;
}

/** Who the clone is measured as: a flag's answer, the identity already set, or the person's
 * answer. `null` when none of them can be had. */
async function identityChoice(
  telemetry: TelemetryDeps,
  prompter: Prompter,
  output: CLIOutput,
  cwd: string,
  options: OnOptions
): Promise<IdentityChoice | null> {
  if (options.as !== undefined) return { set: options.as };
  if (options.anonymous) return "none";
  if ((await telemetry.manageIdentityUseCase.show()).status === "set") return "keep";
  if (options.yes) return null;
  const proposal = await telemetry.proposeIdentityUseCase.execute(cwd);
  const answer = await prompter.select<IdentityChoice | "another">(
    "How should your own measurement name you? The identity stays on this machine.",
    [
      ...(proposal === null
        ? []
        : [{ name: `As "${proposal}", your git name`, value: { set: proposal } }]),
      { name: "As another identifier, typed next", value: "another" },
      { name: "Anonymously", value: "none" },
    ]
  );
  if (answer !== "another") return answer;
  for (;;) {
    const typed = await prompter.input("Identifier (one non-empty line, at most 128 characters):");
    if (personIdOf(typed) !== null) return { set: typed };
    printIdentityRule(output);
  }
}

/** One value per flag, trimmed, and one of `choices` when it has them. Commander keeps the last
 * of a repeated flag silently, and its own `choices` replaces any parser, so both are checked
 * here. A repeat is refused by the flag's name: a bare flag's value is its preset, not what was
 * typed. Its help says what it keeps: "Only the " then `kept`. */
function filterOption(
  command: Command,
  flags: string,
  kept: string,
  choices?: readonly string[]
): Option {
  const option = new Option(flags, `Only the ${kept}`);
  return (choices === undefined ? option : option.choices(choices)).argParser(
    (value: string, previous: string | undefined): string => {
      if (previous !== undefined) {
        command.error(`error: ${option.long} is given twice: give it once.`);
      }
      const text = textOrNull(value);
      if (text === null) throw new InvalidArgumentError("It is empty.");
      if (choices !== undefined && !choices.includes(text)) {
        throw new InvalidArgumentError(`Allowed choices are ${choices.join(", ")}.`);
      }
      return text;
    }
  );
}

export function registerTelemetryCommand(program: Command): void {
  const telemetry = program
    .command("telemetry")
    .description("Measure what Claude Code and Codex sessions consume, locally");

  telemetry
    .command("on")
    .description("Measure this clone, and remove what the previous version left in it")
    .option("--yes", "Do not ask first", false)
    .option("--as <id>", "Name you by this identifier on your own measurement")
    .option("--anonymous", "Name nobody on your own measurement", false)
    .action(async (cmdOptions: OnOptions) => {
      const { output, projectRoot, run } = commandOf(program);
      if (cmdOptions.as !== undefined && cmdOptions.anonymous) {
        output.error("--as names you and --anonymous names nobody: give one of them.");
        process.exit(1);
      }
      if (cmdOptions.as !== undefined && personIdOf(cmdOptions.as) === null) {
        printOnResult(output, { status: "refused", reason: "invalid-identity" });
        process.exit(1);
      }
      if (!cmdOptions.yes && !process.stdout.isTTY) {
        output.error("Nothing to ask in a non-interactive run: pass --yes to turn measurement on.");
        process.exit(1);
      }
      await run(async (deps) => {
        const confirmed =
          cmdOptions.yes ||
          (await deps.prompter.confirm(
            "Measure what this clone consumes, and remove what the previous version left in it?",
            false
          ));
        if (!confirmed) {
          output.info("Nothing changed.");
          return;
        }
        const choice = await identityChoice(
          deps.telemetry,
          deps.prompter,
          output,
          projectRoot,
          cmdOptions
        );
        if (choice === null) {
          output.error(
            "No identity is set, and --yes asks nothing: pass --as <id> to be named, or --anonymous to name nobody."
          );
          process.exit(1);
        }
        const result = await deps.telemetry.telemetryOnUseCase.execute(projectRoot, choice);
        printOnResult(output, result);
        if (result.status === "refused") process.exit(1);
      });
    });

  telemetry
    .command("off")
    .description("Stop measuring this clone; what was measured stays")
    .action(async () => {
      const { output, projectRoot, run } = commandOf(program);
      await run(async (deps) => {
        const result = await deps.telemetry.telemetryOffUseCase.execute(projectRoot);
        printOffResult(output, result);
        if (result.status === "refused") process.exit(1);
      });
    });

  telemetry
    .command("forget")
    .description("Show everything measurement keeps on this machine, or remove it with --yes")
    .option("--yes", "Remove it, instead of only showing it", false)
    .action(async (cmdOptions: { yes: boolean }) => {
      const { output, run } = commandOf(program);
      await run(async (deps) => {
        printForgetResult(
          output,
          await deps.telemetry.forgetTelemetryUseCase.execute(cmdOptions.yes)
        );
      });
    });

  telemetry
    .command("ingest")
    .description("Read new transcripts into the local ledger, for clones that opted in")
    .option("--quiet", "Print nothing on success (for hooks)", false)
    .action(async (cmdOptions: { quiet: boolean }) => {
      const { output, run } = commandOf(program);
      await run(async (deps) => {
        const result = await deps.telemetry.ingestUsageUseCase.execute();
        if (!cmdOptions.quiet) printIngestResult(output, result);
      });
    });

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
        const { output, projectRoot, run } = commandOf(program);
        const request = cmdOptions.none
          ? { kind: "none" as const }
          : requestOf(name, cmdOptions.ticket);
        if (cmdOptions.none && (name !== undefined || cmdOptions.ticket !== undefined)) {
          output.error("--none declares no task: give it neither a name nor --ticket.");
          process.exit(1);
        }
        if (request === null) {
          output.error(
            "A task needs a name: aidd telemetry task <name> [--ticket <ref>], or --none. See what the work is bound to with aidd telemetry status."
          );
          process.exit(1);
        }
        await run(async (deps) => {
          const result = await deps.telemetry.declareTaskUseCase.execute({
            cwd: projectRoot,
            request,
            by: cmdOptions.by,
          });
          printDeclareResult(output, result);
          if (result.status === "refused") process.exit(1);
        });
      }
    );

  telemetry
    .command("status")
    .description("Show if this clone is measured, since when, and its task")
    .action(async () => {
      const { output, projectRoot, run } = commandOf(program);
      await run(async (deps) => {
        printTelemetryStatus(
          output,
          await deps.telemetry.telemetryStatusUseCase.execute(projectRoot)
        );
      });
    });

  const report = telemetry.command("report");
  report
    .description("Show what the work consumed, split along one axis, after reading new transcripts")
    .option("--from <date>", "First day to include, as YYYY-MM-DD (UTC)")
    .option("--to <date>", "Last day to include, as YYYY-MM-DD (UTC)")
    .option("--days <n>", "The last n days, today included")
    .addOption(
      new Option("--axis <axis>", "What to split by").choices(REPORT_AXES).default("total")
    )
    .addOption(filterOption(report, "--task <name>", "calls of this task"))
    .addOption(filterOption(report, "--ticket <ref>", "calls of this ticket, as declared"))
    .addOption(filterOption(report, "--person <id>", "calls of this identity"))
    .addOption(filterOption(report, "--model <id>", "calls of this model"))
    .addOption(filterOption(report, "--agent <agent>", "calls of this agent", USAGE_AGENTS))
    .addOption(
      filterOption(report, "--session <id>", "calls of this session, or a start of its id")
    )
    .addOption(
      filterOption(
        report,
        "--repository <id>",
        "calls of this repository, a start of its id, or . for the one here"
      )
    )
    .addOption(filterOption(report, "--tool <tool>", "calls of this tool", USAGE_TOOLS))
    .addOption(
      filterOption(report, "--absent <axis>", "calls with no value on this axis", ABSENT_AXES)
    )
    .addOption(
      filterOption(
        report,
        "--unattributed [reason]",
        "work with no task, for this reason",
        UNATTRIBUTED_SELECTORS
      ).preset("any")
    )
    .option("--json", "Print a versioned JSON envelope instead of text", false)
    .action(
      async (
        cmdOptions: {
          from?: string;
          to?: string;
          days?: string;
          axis: ReportAxis;
          json: boolean;
        } & Partial<ReportFilters>
      ) => {
        const { output, projectRoot, run } = commandOf(program);
        const period = periodOf(cmdOptions, new Date());
        if (!period.ok) {
          output.error(period.message);
          process.exit(1);
        }
        const given = filtersOf(cmdOptions);
        const filters: RequestedFilters =
          given.repository === "." ? { ...given, repository: null, here: projectRoot } : given;
        await run(async (deps) => {
          const result = await deps.telemetry.reportUsageUseCase.execute({
            axis: cmdOptions.axis,
            period: period.period,
            filters,
          });
          if (
            result.status === "conflicting" ||
            result.status === "not-a-repository" ||
            result.status === "ambiguous"
          ) {
            printUsageReport(output, result);
            process.exit(1);
          }
          if (!cmdOptions.json) return printUsageReport(output, result);
          output.print(
            JSON.stringify(
              result.status === "refused" ? REFUSED_ENVELOPE : reportEnvelopeOf(result),
              null,
              2
            )
          );
        });
      }
    );

  telemetry
    .command("identity [id]")
    .description("Choose to be named on your own measurement, or show or remove that choice")
    .option("--off", "Stop naming you and remove the identity", false)
    .action(async (id: string | undefined, cmdOptions: { off: boolean }) => {
      const { output, run } = commandOf(program);
      if (cmdOptions.off && id !== undefined) {
        output.error("--off removes the identity: give it no identifier.");
        process.exit(1);
      }
      await run(async (deps) => {
        const use = deps.telemetry.manageIdentityUseCase;
        const result = cmdOptions.off
          ? await use.off()
          : id === undefined
            ? await use.show()
            : await use.set(id);
        printIdentityResult(output, result);
        if (result.status === "refused") process.exit(1);
      });
    });
}
