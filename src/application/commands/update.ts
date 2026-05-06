import type { Command } from "commander";
import { Manifest } from "../../domain/models/manifest.js";
import type { AiToolId, IdeToolId } from "../../domain/models/tool-ids.js";
import {
  assertValidToolIds,
  getToolConfig,
  isAiTool,
  type ToolId,
} from "../../domain/tools/registry.js";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { parseGlobalOptions } from "./global-options.js";

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description("Re-install runtime configs from bundled CLI assets (force overwrite)")
    .option("-f, --force", "Overwrite conflicting files without prompting", false)
    .option("--tool <tool>", "Limit update to a specific tool")
    .action(async (cmdOptions: { force: boolean; tool?: string }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      try {
        if (cmdOptions.tool !== undefined) {
          assertValidToolIds([cmdOptions.tool]);
        }

        const deps = await createDeps(projectRoot, { verbose }, output);
        const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
        const installedIds = manifest.getInstalledToolIds();
        const targetIds: ToolId[] = cmdOptions.tool ? [cmdOptions.tool as ToolId] : installedIds;

        if (targetIds.length === 0) {
          output.info("No tools installed. Run `aidd setup` to bootstrap.");
          return;
        }

        const version = deps.currentVersionProvider.get();
        let totalUpdated = 0;
        for (const toolId of targetIds) {
          const config = getToolConfig(toolId);
          const result = isAiTool(config)
            ? await deps.installRuntimeConfigUseCase.execute({
                toolId: toolId as AiToolId,
                projectRoot,
                manifest,
                force: true,
                version,
              })
            : await deps.installIdeConfigUseCase.execute({
                toolId: toolId as IdeToolId,
                projectRoot,
                manifest,
                force: true,
                version,
              });
          for (const w of result.warnings) output.warn(w);
          if (!result.skipped) {
            output.success(`Updated ${result.toolId} (${result.fileCount} files)`);
            totalUpdated += result.fileCount;
          }
        }

        if (totalUpdated === 0) {
          output.info("Nothing to update.");
          return;
        }
        output.print("");
        output.info(`Run \`aidd plugin update\` to update plugins from marketplace.`);
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}
