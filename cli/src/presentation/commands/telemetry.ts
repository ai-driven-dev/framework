import { type Command, Option } from "commander";
import {
  DECLARED_BY,
  type DeclaredBy,
  requestOf,
} from "../../contexts/telemetry/domain/declaration/task-declaration.js";
import { createDeps } from "../../runtime/wiring/framework.js";
import {
  printDeclareResult,
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
}
