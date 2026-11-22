import { type Command, Option } from "commander";
import {
  DECLARED_BY,
  type DeclaredBy,
} from "../../../contexts/telemetry/contract/task-declaration.js";
import { printIngestResult } from "../../presenters/telemetry/telemetry-read.presenter.js";
import {
  printDeclareResult,
  printTelemetryStatus,
} from "../../presenters/telemetry/telemetry-task.presenter.js";
import { commandOf, type TelemetrySurface } from "./telemetry-surface.controller.js";

export function configureIngest(command: Command, { program, createDeps }: TelemetrySurface): void {
  command
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

function declareTaskOptions(task: Command): Command {
  return task
    .description("Declare the task the current work belongs to")
    .option("--ticket <ref>", "The ticket the task belongs to, kept as typed")
    .option("--none", "Declare that this work has no task", false)
    .addOption(
      new Option("--by <by>", "Who declares (hooks only)")
        .choices(DECLARED_BY)
        .default("command")
        .hideHelp()
    );
}

interface TaskOptions {
  readonly ticket?: string;
  readonly none: boolean;
  readonly by: DeclaredBy;
}

export function configureTask(
  command: Command,
  { program, createDeps, requests }: TelemetrySurface
): void {
  declareTaskOptions(command).action(async (name: string | undefined, cmdOptions: TaskOptions) => {
    const { output, projectRoot, runChecked } = commandOf(program, createDeps);
    await runChecked(
      () =>
        requests.parseTaskFlags.execute({
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
  });
}

export function configureStatus(command: Command, { program, createDeps }: TelemetrySurface): void {
  command
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
