import type { Command } from "commander";
import { createDeps } from "../../runtime/wiring/framework.js";
import { printIngestResult } from "../display/telemetry-display.js";
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
}
