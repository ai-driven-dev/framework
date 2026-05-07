import type { Command } from "commander";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { NonInteractiveSyncError, SyncAllUseCase } from "../use-cases/global/sync-all-use-case.js";
import { parseGlobalOptions } from "./global-options.js";

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description(
      "Sync config files across installed AI tools (interactive; use aidd ai sync for non-TTY)"
    )
    .action(async () => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      if (!process.stdout.isTTY) {
        output.error(
          "Non-interactive mode: use `aidd ai sync --source <tool>` or `aidd plugin sync --source <tool>` instead."
        );
        process.exit(1);
      }

      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const useCase = new SyncAllUseCase(
          deps.fs,
          deps.manifestRepo,
          deps.hasher,
          deps.logger,
          deps.syncSourceResolverUseCase,
          deps.syncFilePropagationUseCase,
          deps.pluginInstallFromMarketplaceUseCase
        );
        const result = await useCase.execute({ projectRoot, interactive: process.stdout.isTTY });

        if (result.totalWritten === 0 && result.totalDeleted === 0 && result.totalConflicts === 0) {
          output.success("Nothing to sync.");
          return;
        }
        if (result.totalConflicts > 0) {
          output.warn(
            `${result.totalConflicts} conflict(s) skipped. Use \`aidd ai sync --force\` to overwrite.`
          );
        }
        output.success(
          `Synced ${result.totalWritten} file(s), deleted ${result.totalDeleted} file(s) from ${result.sourceTool}`
        );
      } catch (error) {
        if (error instanceof NonInteractiveSyncError) {
          output.error(error.message);
          process.exit(1);
        }
        errorHandler.handle(error);
      }
    });
}
