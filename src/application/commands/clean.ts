import type { Command } from "commander";
import { createDeps } from "../../infrastructure/deps.js";
import { CLIOutput } from "../output.js";
import { CleanUseCase } from "../use-cases/clean-use-case.js";

export function registerCleanCommand(program: Command): void {
  program
    .command("clean")
    .description("Remove all AIDD-managed files from the project")
    .option("--force", "Confirm file removal (skip dry-run)", false)
    .action(async (cmdOptions: { force: boolean }) => {
      const globalOptions = program.opts<{ verbose: boolean }>();
      const verbose = globalOptions.verbose ?? false;
      const output = new CLIOutput(verbose);
      const projectRoot = process.cwd();

      try {
        const deps = await createDeps(projectRoot, { verbose }, output);

        const useCase = new CleanUseCase(deps.fs, deps.manifestRepo, deps.logger);
        const result = await useCase.execute({ projectRoot, force: cmdOptions.force });

        if (result.preview.totalFileCount === 0 && !result.dryRun) {
          output.success("Nothing to clean. No AIDD installation found.");
          return;
        }

        if (result.dryRun) {
          output.print("The following will be removed:");
          for (const tool of result.preview.tools) {
            output.print(`  ${tool.toolId}: ${tool.fileCount} files`);
          }
          if (result.preview.docsFileCount > 0) {
            output.print(`  docs: ${result.preview.docsFileCount} files`);
          }
          output.print("  manifest: .aidd/");
          const toolCount = result.preview.tools.length;
          output.success(
            `Would remove ${result.preview.totalFileCount} files across ${toolCount} ${toolCount === 1 ? "tool" : "tools"}. Use --force to confirm.`
          );
          return;
        }

        output.success(`Cleaned all AIDD files (${result.fileCount} files removed)`);
      } catch (error) {
        output.exit(error);
      }
    });
}
