import type { Command } from "commander";
import { parsePluginSpec } from "../../domain/models/plugin.js";
import {
  describePluginSource,
  parsePluginSourceShorthand,
} from "../../domain/models/plugin-source.js";
import { assertValidAiToolId, parseToolOption } from "../../domain/models/tool-ids.js";
import { createDeps, createMenuDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { parseGlobalOptions } from "./global-options.js";
import { spawnCliCommand } from "./shared/spawn-cli-command.js";

export function registerPluginCommand(program: Command): void {
  const plugin = program.command("plugin").description("Manage plugins for AI tools");

  plugin.action(async () => {
    if (!process.stdout.isTTY) {
      plugin.help();
      return;
    }
    const { prompter } = createMenuDeps(process.cwd());
    const choice = await prompter.select("plugin: what do you want to do?", [
      { name: "Install from marketplace", value: "install" },
      { name: "Add local plugin", value: "add" },
      { name: "List installed plugins", value: "list" },
      { name: "Search plugins", value: "search", description: "requires query arg" },
      { name: "Update plugins", value: "update" },
      { name: "Remove a plugin", value: "remove", description: "requires name arg" },
    ]);
    await spawnCliCommand(["plugin", choice]);
  });

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
        await deps.marketplaceSyncSettingsUseCase.execute({ projectRoot });
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
        await deps.marketplaceSyncSettingsUseCase.execute({ projectRoot });
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
    .command("install <plugin>")
    .description("Install a plugin from a registered marketplace")
    .option("--from <market>", "Marketplace name (when multiple match)")
    .option("--tool <toolId>", "Target AI tool (default: all installed)")
    .option("--token <value>", "Auth token (host detected from source URL at fetch time)")
    .option("--yes", "Auto-resolve interactive prompts (CI mode)")
    .action(
      async (
        pluginArg: string,
        cmdOptions: { from?: string; tool?: string; token?: string; yes?: boolean }
      ) => {
        const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
        const errorHandler = new ErrorHandler(output);
        try {
          assertValidAiToolId(cmdOptions.tool);
          const { name, version } = parsePluginSpec(pluginArg);
          if (cmdOptions.token) process.env.AIDD_TOKEN = cmdOptions.token;
          const deps = await createDeps(projectRoot, { verbose, repo }, output);
          const result = await deps.pluginInstallFromMarketplaceUseCase.execute({
            pluginName: name,
            version,
            fromMarketplace: cmdOptions.from,
            toolIds: parseToolOption(cmdOptions.tool),
            projectRoot,
            interactive: process.stdout.isTTY,
            autoSelect: cmdOptions.yes ?? false,
          });
          await deps.marketplaceSyncSettingsUseCase.execute({ projectRoot });
          output.success(
            `Installed '${result.entry.name}' from '${result.marketplace.name}' (${describePluginSource(result.marketplace.source)}).`
          );
        } catch (error) {
          errorHandler.handle(error);
        }
      }
    );

  plugin
    .command("search <query>")
    .description("Search registered marketplaces for plugins")
    .option("--recommended", "Show only recommended plugins")
    .option("--marketplace <name>", "Limit to a single marketplace")
    .action(async (query: string, cmdOptions: { recommended?: boolean; marketplace?: string }) => {
      const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose, repo }, output);
        const { hits } = await deps.pluginSearchUseCase.execute({
          query,
          recommendedOnly: cmdOptions.recommended ?? false,
          marketplace: cmdOptions.marketplace,
          projectRoot,
        });
        if (hits.length === 0) output.info("No matches.");
        for (const h of hits) {
          const flag = h.entry.recommended ? " (recommended)" : "";
          output.print(
            `${h.entry.name}@${h.entry.version ?? "?"} — ${h.entry.description ?? ""} — marketplace: ${h.marketplace.name}${flag}`
          );
        }
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  plugin
    .command("pick")
    .description("Interactively pick a marketplace and install plugins from it")
    .option("--tool <toolId>", "Target AI tool (default: all installed)")
    .action(async (cmdOptions: { tool?: string }) => {
      const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        assertValidAiToolId(cmdOptions.tool);
        const deps = await createDeps(projectRoot, { verbose, repo }, output);
        const result = await deps.pluginPickUseCase.execute({
          toolIds: parseToolOption(cmdOptions.tool),
          projectRoot,
          interactive: process.stdout.isTTY,
        });
        await deps.marketplaceSyncSettingsUseCase.execute({ projectRoot });
        if (result.installed.length === 0) {
          output.info(`No plugins selected from '${result.marketplace.name}'.`);
        } else {
          output.success(
            `Installed ${result.installed.length} plugin(s) from '${result.marketplace.name}': ${result.installed.join(", ")}`
          );
        }
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
        await deps.marketplaceSyncSettingsUseCase.execute({ projectRoot });
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
