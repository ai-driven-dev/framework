import type { Command } from "commander";
import { type ToolId, VALID_TOOL_IDS } from "../../domain/models/tool-config.js";
import { createDeps } from "../../infrastructure/deps.js";
import { printUpdateBanner } from "../check-update.js";
import { CLIOutput } from "../output.js";
import { UninstallUseCase } from "../use-cases/uninstall-use-case.js";

export function registerUninstallCommand(program: Command): void {
  program
    .command("uninstall")
    .description("Remove a tool's generated configuration files")
    .argument("[tools...]", "Tool IDs to uninstall (e.g., claude, cursor, copilot)")
    .option("-a, --all", "Uninstall all installed tools", false)
    .action(async (toolArgs: string[], cmdOptions: { all: boolean }) => {
      const globalOptions = program.opts<{ verbose: boolean }>();
      const verbose = globalOptions.verbose ?? false;
      const output = new CLIOutput(verbose);
      const projectRoot = process.cwd();

      if (!cmdOptions.all && toolArgs.length === 0) {
        output.error(
          `Specify at least one tool or use --all. Valid tools: ${VALID_TOOL_IDS.join(", ")}`
        );
        process.exit(1);
      }

      if (cmdOptions.all && toolArgs.length > 0) {
        output.warn(`--all is set; ignoring specified tools: ${toolArgs.join(", ")}`);
      }

      try {
        const deps = await createDeps(projectRoot, { verbose }, output);

        await printUpdateBanner(deps.resolver, deps.manifestRepo, output);

        let toolIds: ToolId[];
        if (cmdOptions.all) {
          const manifest = await deps.manifestRepo.load();
          if (!manifest) throw new Error("No AIDD installation found. Run `aidd init` first.");
          toolIds = manifest.getInstalledToolIds();
          if (toolIds.length === 0) {
            output.success("No tools installed. Run `aidd install <tool>` to get started.");
            return;
          }
        } else {
          toolIds = toolArgs as ToolId[];
          output.validateTools(toolIds, VALID_TOOL_IDS);
        }

        const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
        const results = await useCase.execute({ toolIds, projectRoot });

        const totalFileCount = results.reduce((sum, r) => sum + r.fileCount, 0);

        if (results.length === 1) {
          output.success(
            `Uninstalled ${results[0].toolId} (${results[0].fileCount} files removed)`
          );
        } else {
          const toolList = results.map((r) => r.toolId).join(", ");
          output.success(`Uninstalled ${toolList} (${totalFileCount} files removed)`);
        }
      } catch (error) {
        output.exit(error);
      }
    });
}
