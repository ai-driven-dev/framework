import type { Command } from "commander";
import { printIngestResult } from "../../presenters/telemetry/telemetry-read.presenter.js";
import {
  printDeclareResult,
  printTelemetryStatus,
} from "../../presenters/telemetry/telemetry-task.presenter.js";
import { commandOf, type TelemetrySurface } from "./telemetry-surface.controller.js";

export function configureIngest(
  command: Command,
  { program, containerOf }: TelemetrySurface
): void {
  command
    .description("Read new transcripts into the local ledger, for clones that opted in")
    .option("--quiet", "Print nothing on success (for hooks)", false)
    .action(async (cmdOptions: { quiet: boolean }) => {
      const { output, run } = commandOf(program, containerOf);
      await run(async (container) => {
        const result = await container.telemetry.ingestUsage.execute();
        if (!cmdOptions.quiet) printIngestResult(output, result);
      });
    });
}

function declareTaskOptions(task: Command): Command {
  return task
    .description("Declare the task the current work belongs to")
    .option("--ticket <ref>", "The ticket the task belongs to, kept as typed")
    .option("--none", "Declare that this work has no task", false);
}

interface TaskOptions {
  readonly ticket?: string;
  readonly none: boolean;
}

export function configureTask(
  command: Command,
  { program, containerOf, requests }: TelemetrySurface
): void {
  declareTaskOptions(command).action(async (name: string | undefined, cmdOptions: TaskOptions) => {
    const { output, projectRoot, runChecked } = commandOf(program, containerOf);
    await runChecked(
      () =>
        requests.parseTaskFlags.execute({
          name,
          ticket: cmdOptions.ticket,
          none: cmdOptions.none,
        }),
      async (container, { request }) => {
        const result = await container.telemetry.declareTask.execute({
          cwd: projectRoot,
          request,
        });
        printDeclareResult(output, result);
        if (result.status === "refused") output.exit(1);
      }
    );
  });
}

export function configureStatus(
  command: Command,
  { program, containerOf }: TelemetrySurface
): void {
  command
    .description("Show if this clone is measured, since when, and its task")
    .action(async () => {
      const { output, projectRoot, run } = commandOf(program, containerOf);
      await run(async (container) => {
        printTelemetryStatus(
          output,
          await container.telemetry.readTelemetryStatus.execute({ cwd: projectRoot })
        );
      });
    });
}
