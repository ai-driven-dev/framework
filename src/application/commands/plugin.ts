import type { Command } from "commander";
import { parsePluginSourceShorthand } from "../../domain/models/plugin-source.js";
import { assertValidAiToolId, parseToolOption } from "../../domain/models/tool-ids.js";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { parseGlobalOptions } from "./global-options.js";

export function registerPluginCommand(program: Command): void {
  const plugin = program.command("plugin").description("Manage plugins for AI tools");

  plugin
    .command("add <source>")
    .description("Add a plugin to one or all AI tools")
    .option("--tool <toolId>", "Target AI tool (default: all installed)")
    .action(async (sourceArg: string, cmdOptions: { tool?: string }) => {
      const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        assertValidAiToolId(cmdOptions.tool);
        const source = parsePluginSourceShorthand(sourceArg);
        const deps = await createDeps(projectRoot, { verbose, repo }, output);
        await deps.pluginAddUseCase.execute({
          source,
          toolIds: parseToolOption(cmdOptions.tool),
          projectRoot,
          interactive: process.stdout.isTTY,
        });
        output.success(`Plugin added successfully.`);
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  plugin
    .command("remove <name>")
    .description("Remove a plugin from one or all AI tools")
    .option("--tool <toolId>", "Target AI tool (default: all installed)")
    .action(async (name: string, cmdOptions: { tool?: string }) => {
      const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        assertValidAiToolId(cmdOptions.tool);
        const deps = await createDeps(projectRoot, { verbose, repo }, output);
        await deps.pluginRemoveUseCase.execute({
          pluginName: name,
          toolIds: parseToolOption(cmdOptions.tool),
          projectRoot,
        });
        output.success(`Plugin '${name}' removed.`);
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  plugin
    .command("list")
    .description("List installed plugins for one or all AI tools")
    .option("--tool <toolId>", "Target AI tool (default: all installed)")
    .action(async (cmdOptions: { tool?: string }) => {
      const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        assertValidAiToolId(cmdOptions.tool);
        const deps = await createDeps(projectRoot, { verbose, repo }, output);
        const result = await deps.pluginListUseCase.execute({
          toolIds: parseToolOption(cmdOptions.tool),
        });
        let printed = false;
        for (const [toolId, plugins] of result) {
          if (plugins.length === 0) continue;
          output.print(`${toolId}:`);
          for (const p of plugins) output.print(`  ${p.name}@${p.version}`);
          printed = true;
        }
        if (!printed) output.info("No plugins installed.");
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  plugin
    .command("update [name]")
    .description("Update one or all plugins for one or all AI tools")
    .option("--tool <toolId>", "Target AI tool (default: all installed)")
    .action(async (name: string | undefined, cmdOptions: { tool?: string }) => {
      const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        assertValidAiToolId(cmdOptions.tool);
        const deps = await createDeps(projectRoot, { verbose, repo }, output);
        const updated = await deps.pluginUpdateUseCase.execute({
          pluginNames: name !== undefined ? [name] : undefined,
          toolIds: parseToolOption(cmdOptions.tool),
          projectRoot,
        });
        if (updated.length === 0) {
          output.success("All plugins are up to date.");
        } else {
          output.success(`Updated: ${updated.join(", ")}.`);
        }
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}
