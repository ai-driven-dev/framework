import type { Command } from "commander";
import { createDeps } from "../../infrastructure/deps.js";
import { CLIOutput } from "../output.js";
import { SelfUpdateUseCase } from "../use-cases/self-update-use-case.js";

export function registerSelfUpdateCommand(program: Command): void {
  program
    .command("self-update")
    .description("Update the aidd CLI to the latest version")
    .option("--check", "Check if a newer version is available without installing", false)
    .option("--dry-run", "Preview the update without installing", false)
    .option("-f, --force", "Reinstall even if already up to date", false)
    .action(async (cmdOptions: { check: boolean; dryRun: boolean; force: boolean }) => {
      const globalOptions = program.opts<{ verbose?: boolean; token?: string }>();
      const output = new CLIOutput(globalOptions.verbose ?? false);

      try {
        const deps = await createDeps(
          process.cwd(),
          { verbose: globalOptions.verbose ?? false, token: globalOptions.token },
          output
        );

        const useCase = new SelfUpdateUseCase(deps.cliUpdater, deps.currentVersionProvider);
        const result = await useCase.execute({
          check: cmdOptions.check,
          dryRun: cmdOptions.dryRun,
          force: cmdOptions.force,
        });

        switch (result.kind) {
          case "up-to-date":
          case "check-current":
            output.success(`Already up to date (${result.version})`);
            break;
          case "check-available":
            output.info(
              `New version available: ${result.latestVersion} (current: ${result.currentVersion})`
            );
            break;
          case "dry-run":
            output.info(`Would install @ai-driven-dev/cli@${result.latestVersion}`);
            break;
          case "updated": {
            const binaryPart = result.binaryPath ? ` (${result.binaryPath})` : "";
            output.success(`Successfully updated to version ${result.latestVersion}${binaryPart}`);
            if (result.changelog) {
              output.info(`\nChangelog:\n${result.changelog}`);
            }
            break;
          }
        }
      } catch (error) {
        output.exit(error);
      }
    });
}
