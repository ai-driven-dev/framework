import type { Command } from "commander";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { RestoreAllUseCase } from "../use-cases/global/restore-all-use-case.js";
import { parseGlobalOptions } from "./global-options.js";

export function registerRestoreCommand(program: Command): void {
  program
    .command("restore")
    .description("Restore tracked files to their installed version (from manifest hashes)")
    .option("-f, --force", "Restore without prompting", false)
    .action(async (cmdOptions: { force: boolean }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const interactive = !cmdOptions.force && process.stdout.isTTY;
        const useCase = new RestoreAllUseCase(
          deps.fs,
          deps.manifestRepo,
          deps.hasher,
          deps.logger,
          deps.platform,
          deps.prompter,
          deps.pluginFetcher,
          deps.pluginDistributionReader
        );
        const result = await useCase.execute(projectRoot, interactive);

        for (const e of result.errors) output.warn(`[${e.scope}] ${e.message}`);

        if (result.totalRestored === 0 && result.pluginNamesRestored.length === 0) {
          output.success("Nothing to restore — all files are unmodified.");
          return;
        }
        if (result.totalRestored > 0) {
          output.success(
            `Restored ${result.totalRestored} file(s), kept ${result.totalKept} file(s)`
          );
        }
        if (result.pluginNamesRestored.length > 0) {
          output.success(`Restored plugins: ${result.pluginNamesRestored.join(", ")}`);
        }
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}
