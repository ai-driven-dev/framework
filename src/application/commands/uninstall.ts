import type { Command } from "commander";
import {
  assertToolIdsMatchCategory,
  assertValidToolIds,
  type ToolId,
  toolIdsForCategory,
} from "../../domain/tools/registry.js";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { NoManifestError, NoToolsInstalledError } from "../errors.js";
import { UninstallUseCase } from "../use-cases/uninstall-use-case.js";
import { parseCategoryArg, parseGlobalOptions } from "./global-options.js";

export function registerUninstallCommand(program: Command): void {
  program
    .command("uninstall")
    .description("Remove a tool's generated configuration files")
    .argument("[category]", "Category to uninstall: ai or ide")
    .argument("[tool...]", "Tool IDs to uninstall (e.g. claude cursor vscode)")
    .addHelpText(
      "after",
      `
Examples:
  aidd uninstall ai claude        Uninstall a specific AI tool
  aidd uninstall ide vscode       Uninstall a specific IDE integration
  aidd uninstall ai --all         Uninstall all AI tools
  aidd uninstall --all            Uninstall all tools`
    )
    .option("-a, --all", "Uninstall all installed tools", false)
    .option("--mcp <servers>", "Comma-separated list of MCP servers to remove")
    .action(
      async (
        categoryArg: string | undefined,
        toolArgs: string[],
        cmdOptions: { all: boolean; mcp?: string }
      ) => {
        const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
        const errorHandler = new ErrorHandler(output);

        const category = parseCategoryArg(categoryArg, output);

        if (cmdOptions.all && toolArgs.length > 0) {
          output.warn(`--all is set; ignoring specified tools: ${toolArgs.join(", ")}`);
        }

        try {
          const deps = await createDeps(projectRoot, { verbose }, output);

          let toolIds: ToolId[];

          if (cmdOptions.all) {
            const manifest = await deps.manifestRepo.load();
            if (!manifest) throw new NoManifestError(repo);
            const allInstalled = manifest.getInstalledToolIds();
            toolIds = category
              ? allInstalled.filter((id) =>
                  (toolIdsForCategory(category) as readonly string[]).includes(id)
                )
              : allInstalled;
            if (toolIds.length === 0) {
              output.success("No tools installed. Run `aidd install ai <tool>` to get started.");
              return;
            }
          } else if (toolArgs.length > 0) {
            toolIds = toolArgs as ToolId[];
            assertValidToolIds(toolIds);
            if (category) assertToolIdsMatchCategory(toolIds, category);
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
            const candidates = category
              ? installedIds.filter((id) =>
                  (toolIdsForCategory(category) as readonly string[]).includes(id)
                )
              : installedIds;

            if (candidates.length === 0) {
              throw new NoToolsInstalledError(category);
            }

            const choices = candidates.map((id) => ({ name: id, value: id, checked: false }));
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

          const mcpFilter = cmdOptions.mcp?.split(",").map((s) => s.trim()) ?? [];

          const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
          const results = await useCase.execute({ toolIds, projectRoot, repo, mcpFilter });

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
          errorHandler.handle(error);
        }
      }
    );
}
