import type { Command } from "commander";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { MigrateUseCase } from "../use-cases/migrate-use-case.js";
import { parseGlobalOptions } from "./global-options.js";

export function registerMigrateCommand(program: Command): void {
  program
    .command("migrate")
    .description("Migrate project from bundled framework format to marketplace-only architecture")
    .option("--dry-run", "Detect and display migration plan without applying changes")
    .option("--non-interactive", "Apply migration without interactive prompts")
    .action(async (cmdOptions: { dryRun?: boolean; nonInteractive?: boolean }) => {
      const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose, repo }, output);
        const result = await new MigrateUseCase(
          deps.fs,
          deps.manifestRepo,
          deps.logger,
          deps.prompter,
          deps.marketplaceRegisterFrameworkUseCase,
          deps.pluginInstallFromMarketplaceUseCase
        ).execute({
          projectRoot,
          interactive: !cmdOptions.nonInteractive && process.stdout.isTTY,
          dryRun: cmdOptions.dryRun ?? false,
        });
        switch (result.kind) {
          case "no-op":
            output.info("Nothing to migrate.");
            break;
          case "dry-run":
            output.info("Dry-run complete. No changes applied.");
            break;
          case "aborted":
            output.info("Migration aborted.");
            break;
          case "migrated":
            output.success("Migration complete.");
            break;
        }
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}
