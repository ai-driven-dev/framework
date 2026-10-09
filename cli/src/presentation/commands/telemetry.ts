import { type Command, Option } from "commander";
import {
  REFUSED_ENVELOPE,
  reportEnvelopeOf,
} from "../../contexts/telemetry/application/report/report-envelope.js";
import {
  DECLARED_BY,
  type DeclaredBy,
  requestOf,
} from "../../contexts/telemetry/domain/declaration/task-declaration.js";
import { periodOf } from "../../contexts/telemetry/domain/report/period.js";
import {
  REPORT_AXES,
  type ReportAxis,
} from "../../contexts/telemetry/domain/report/usage-report.js";
import { createDeps } from "../../runtime/wiring/framework.js";
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
  printTaskBinding,
} from "../display/telemetry-display.js";
import { ErrorHandler } from "../error-handler.js";
import { parseGlobalOptions } from "./global-options.js";

export function registerTelemetryCommand(program: Command): void {
  const telemetry = program
    .command("telemetry")
    .description("Measure what Claude Code sessions consume, locally");

  telemetry
    .command("on")
    .description("Measure this repository, and remove what the previous version left in it")
    .option("--yes", "Do not ask first", false)
    .action(async (cmdOptions: { yes: boolean }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      if (!cmdOptions.yes && !process.stdout.isTTY) {
        output.error("Nothing to ask in a non-interactive run: pass --yes to turn measurement on.");
        process.exit(1);
      }
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const confirmed =
          cmdOptions.yes ||
          (await deps.prompter.confirm(
            "Measure what this repository consumes, and remove what the previous version left in it?",
            false
          ));
        if (!confirmed) {
          output.info("Nothing changed.");
          return;
        }
        const result = await deps.telemetry.telemetryOnUseCase.execute(projectRoot);
        printOnResult(output, result);
        if (result.status === "refused") process.exit(1);
      } catch (error) {
        new ErrorHandler(output).handle(error);
      }
    });

  telemetry
    .command("off")
    .description("Stop measuring this repository; what was measured stays")
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
    .description("Read new transcripts into the local ledger, for projects that opted in")
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
    .description("Declare the task the current work belongs to, or show what it is bound to")
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
        if (request === null && (name !== undefined || cmdOptions.ticket !== undefined)) {
          output.error("A task needs a name: aidd telemetry task <name> [--ticket <ref>].");
          process.exit(1);
        }
        try {
          const deps = await createDeps(projectRoot, { verbose }, output);
          if (request === null) {
            const shown = await deps.telemetry.showTaskBindingUseCase.execute(projectRoot);
            printTaskBinding(output, shown);
            if (shown.status === "refused") process.exit(1);
            return;
          }
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
