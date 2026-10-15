import { type Command, Option } from "commander";
import {
  REFUSED_ENVELOPE,
  reportEnvelopeOf,
} from "../../contexts/telemetry/application/report/report-envelope.js";
import type { IdentityChoice } from "../../contexts/telemetry/application/switch/telemetry-on-use-case.js";
import {
  DECLARED_BY,
  type DeclaredBy,
  requestOf,
} from "../../contexts/telemetry/domain/declaration/task-declaration.js";
import { personIdOf } from "../../contexts/telemetry/domain/identity/person-identity.js";
import { periodOf } from "../../contexts/telemetry/domain/report/period.js";
import {
  REPORT_AXES,
  type ReportAxis,
} from "../../contexts/telemetry/domain/report/usage-report.js";
import type { Prompter } from "../../kernel/ports/prompter.js";
import { createDeps } from "../../runtime/wiring/framework.js";
import type { TelemetryDeps } from "../../runtime/wiring/telemetry.js";
import {
  printForgetResult,
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
import { parseGlobalOptions } from "./global-options.js";

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
  }
}

export function registerTelemetryCommand(program: Command): void {
  const telemetry = program
    .command("telemetry")
    .description("Measure what Claude Code sessions consume, locally");

  telemetry
    .command("on")
    .description("Measure this clone, and remove what the previous version left in it")
    .option("--yes", "Do not ask first", false)
    .option("--as <id>", "Name you by this identifier on your own measurement")
    .option("--anonymous", "Name nobody on your own measurement", false)
    .action(async (cmdOptions: OnOptions) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
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
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
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
        const choice = await identityChoice(deps.telemetry, deps.prompter, projectRoot, cmdOptions);
        if (choice === null) {
          output.error(
            "No identity is set, and --yes asks nothing: pass --as <id> to be named, or --anonymous to name nobody."
          );
          process.exit(1);
        }
        const result = await deps.telemetry.telemetryOnUseCase.execute(projectRoot, choice);
        printOnResult(output, result);
        if (result.status === "refused") process.exit(1);
      } catch (error) {
        new ErrorHandler(output).handle(error);
      }
    });

  telemetry
    .command("off")
    .description("Stop measuring this clone; what was measured stays")
    .action(async () => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const result = await deps.telemetry.telemetryOffUseCase.execute(projectRoot);
        printOffResult(output, result);
        if (result.status === "refused") process.exit(1);
      } catch (error) {
        new ErrorHandler(output).handle(error);
      }
    });

  telemetry
    .command("forget")
    .description("Show everything measurement keeps on this machine, or remove it with --yes")
    .option("--yes", "Remove it, instead of only showing it", false)
    .action(async (cmdOptions: { yes: boolean }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        printForgetResult(
          output,
          await deps.telemetry.forgetTelemetryUseCase.execute(cmdOptions.yes)
        );
      } catch (error) {
        new ErrorHandler(output).handle(error);
      }
    });

  telemetry
    .command("ingest")
    .description("Read new transcripts into the local ledger, for clones that opted in")
    .option("--quiet", "Print nothing on success (for hooks)", false)
    .action(async (cmdOptions: { quiet: boolean }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const result = await deps.telemetry.ingestUsageUseCase.execute();
        if (!cmdOptions.quiet) printIngestResult(output, result);
      } catch (error) {
        new ErrorHandler(output).handle(error);
      }
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
        const { verbose, output, projectRoot } = parseGlobalOptions(program);
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
        try {
          const deps = await createDeps(projectRoot, { verbose }, output);
          const result = await deps.telemetry.declareTaskUseCase.execute({
            cwd: projectRoot,
            request,
            by: cmdOptions.by,
          });
          printDeclareResult(output, result);
          if (result.status === "refused") process.exit(1);
        } catch (error) {
          new ErrorHandler(output).handle(error);
        }
      }
    );

  telemetry
    .command("status")
    .description("Show if this clone is measured, since when, and its task")
    .action(async () => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        printTelemetryStatus(
          output,
          await deps.telemetry.telemetryStatusUseCase.execute(projectRoot)
        );
      } catch (error) {
        new ErrorHandler(output).handle(error);
      }
    });

  telemetry
    .command("report")
    .description("Show what the work consumed, split along one axis, after reading new transcripts")
    .option("--from <date>", "First day to include, as YYYY-MM-DD (UTC)")
    .option("--to <date>", "Last day to include, as YYYY-MM-DD (UTC)")
    .option("--days <n>", "The last n days, today included")
    .addOption(
      new Option("--axis <axis>", "What to split by").choices(REPORT_AXES).default("total")
    )
    .option("--json", "Print a versioned JSON envelope instead of text", false)
    .action(
      async (cmdOptions: {
        from?: string;
        to?: string;
        days?: string;
        axis: ReportAxis;
        json: boolean;
      }) => {
        const { verbose, output, projectRoot } = parseGlobalOptions(program);
        const period = periodOf(cmdOptions, new Date());
        if (!period.ok) {
          output.error(period.message);
          process.exit(1);
        }
        try {
          const deps = await createDeps(projectRoot, { verbose }, output);
          const result = await deps.telemetry.reportUsageUseCase.execute({
            axis: cmdOptions.axis,
            period: period.period,
          });
          if (!cmdOptions.json) return printUsageReport(output, result);
          output.print(
            JSON.stringify(
              result.status === "refused" ? REFUSED_ENVELOPE : reportEnvelopeOf(result),
              null,
              2
            )
          );
        } catch (error) {
          new ErrorHandler(output).handle(error);
        }
      }
    );

  telemetry
    .command("identity [id]")
    .description("Choose to be named on your own measurement, or show or remove that choice")
    .option("--off", "Stop naming you and remove the identity", false)
    .action(async (id: string | undefined, cmdOptions: { off: boolean }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      if (cmdOptions.off && id !== undefined) {
        output.error("--off removes the identity: give it no identifier.");
        process.exit(1);
      }
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const use = deps.telemetry.manageIdentityUseCase;
        const result = cmdOptions.off
          ? await use.off()
          : id === undefined
            ? await use.show()
            : await use.set(id);
        printIdentityResult(output, result);
        if (result.status === "refused") process.exit(1);
      } catch (error) {
        new ErrorHandler(output).handle(error);
      }
    });
}
