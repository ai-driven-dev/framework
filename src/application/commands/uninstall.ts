import type { Command } from "commander";
import { assertValidToolIds, type ToolId } from "../../domain/models/tool-config.js";
import { createDeps } from "../../infrastructure/deps.js";
import { NoManifestError } from "../errors.js";
import { UninstallUseCase } from "../use-cases/uninstall-use-case.js";
import { parseGlobalOptions } from "./global-options.js";

export function registerUninstallCommand(program: Command): void {
  program
    .command("uninstall")
    .description("Remove a tool's generated configuration files")
    .argument("[tools...]", "Tool IDs to uninstall (e.g., claude, cursor, copilot)")
    .option("-a, --all", "Uninstall all installed tools", false)
    .action(async (toolArgs: string[], cmdOptions: { all: boolean }) => {
      const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);

      if (cmdOptions.all && toolArgs.length > 0) {
        output.warn(`--all is set; ignoring specified tools: ${toolArgs.join(", ")}`);
      }

      try {
        const deps = await createDeps(projectRoot, { verbose }, output);

        let toolIds: ToolId[];

        if (cmdOptions.all) {
          const manifest = await deps.manifestRepo.load();
          if (!manifest) throw new NoManifestError(repo);
          toolIds = manifest.getInstalledToolIds();
          if (toolIds.length === 0) {
            output.success("No tools installed. Run `aidd install <tool>` to get started.");
            return;
          }
        } else if (toolArgs.length > 0) {
          toolIds = toolArgs as ToolId[];
          assertValidToolIds(toolIds);
        } else {
          if (!process.stdout.isTTY) {
            output.error(
              "aidd uninstall requires tool arguments or --all in non-interactive mode."
            );
            process.exit(1);
          }

          const manifest = await deps.manifestRepo.load();
          if (!manifest) throw new NoManifestError(repo);

          const installedIds = manifest.getInstalledToolIds();
          if (installedIds.length === 0) {
            output.error("No tools installed.");
            process.exit(1);
          }

          const choices = installedIds.map((id) => ({ name: id, value: id, checked: false }));

          const selected = await deps.prompter.checkbox(
            "Which tools do you want to uninstall?",
            choices
          );

          if (selected.length === 0) {
            output.print("No tools selected.");
            return;
          }

          toolIds = selected as ToolId[];
        }

        const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
        const results = await useCase.execute({ toolIds, projectRoot, repo: repo });

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
