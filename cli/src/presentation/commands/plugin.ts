import type { Command } from "commander";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import { UnknownAiToolIdError } from "../../shared/domain/errors.js";
import { parseScope } from "../../shared/domain/scope.js";
import type { AiToolId } from "../../shared/domain/tool.js";
import type { DepsSliceFactory, MenuDepsSliceFactory } from "../deps.js";
import {
  printInstalledPlugins,
  printPluginInstallOutcome,
  printPluginRemoved,
  printPluginsUpdated,
  printSearchHits,
} from "../display/plugin-display.js";
import { reportNativeActivation } from "../display/sync-display.js";
import { failCommand } from "../errors/error-translator.js";
import { spawnCliCommand } from "../terminal/child-command.js";
import { parseGlobalOptions } from "./global-options.js";

/** What this command reads of the graph. */
type PluginKeys =
  | "pluginRemoveUseCase"
  | "userPluginRemove"
  | "pluginListUseCase"
  | "pluginInstallUseCase"
  | "searchPlugins"
  | "userPluginUpdateUseCase"
  | "pluginUpdateUseCase"
  | "syncNativeActivation";

/** `--tool` names one AI tool or, left out or set to `all`, every one. */
export function parseToolOption(
  tool: string | undefined,
  catalog: ToolCatalog
): AiToolId[] | "all" {
  if (tool === undefined || tool === "all") return "all";
  const id = catalog.aiToolId(tool);
  if (id === null) throw new UnknownAiToolIdError(tool, catalog.idsInCanonicalOrder("ai"));
  return [id];
}

export function registerPluginCommand(
  program: Command,
  catalog: ToolCatalog,
  createDeps: DepsSliceFactory<PluginKeys>,
  createMenuDeps: MenuDepsSliceFactory<"prompter">
): void {
  const plugin = program.command("plugin").description("Manage plugins for AI tools");

  plugin.action(async () => {
    if (!process.stdout.isTTY) {
      plugin.help();
      return;
    }
    const { prompter } = createMenuDeps(process.cwd());
    const choice = await prompter.select("plugin: what do you want to do?", [
      { name: "Install plugin", value: "install" },
      { name: "List installed plugins", value: "list" },
      { name: "Search plugins", value: "search", description: "requires query arg" },
      { name: "Update plugins", value: "update" },
      { name: "Remove a plugin", value: "remove", description: "requires name arg" },
    ]);
    await spawnCliCommand(["plugin", choice]);
  });

  plugin
    .command("remove <name>")
    .description("Remove a plugin from one or all AI tools")
    .option("--tool <toolId>", "Target AI tool (default: all installed)")
    .option("--scope <user|project>", "Removal scope (default: project)")
    .action(async (name: string, cmdOptions: { tool?: string; scope?: string }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      try {
        const toolIds = parseToolOption(cmdOptions.tool, catalog);
        const scope = parseScope(cmdOptions.scope) ?? "project";
        const deps = await createDeps(projectRoot, { verbose }, output);
        const removal = { pluginName: name, toolIds, projectRoot };
        await (scope === "user" ? deps.userPluginRemove : deps.pluginRemoveUseCase).execute(
          removal
        );
        if (scope === "project") {
          reportNativeActivation(output, await deps.syncNativeActivation.execute({ projectRoot }));
        }
        printPluginRemoved(output, name);
      } catch (error) {
        failCommand(output, error);
      }
    });

  plugin
    .command("list")
    .description("List installed plugins for one or all AI tools")
    .option("--tool <toolId>", "Target AI tool (default: all installed)")
    .action(async (cmdOptions: { tool?: string }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      try {
        const toolIds = parseToolOption(cmdOptions.tool, catalog);
        const deps = await createDeps(projectRoot, { verbose }, output);
        const result = await deps.pluginListUseCase.execute({
          toolIds,
        });
        printInstalledPlugins(output, result);
      } catch (error) {
        failCommand(output, error);
      }
    });

  plugin
    .command("install [plugin]")
    .description("Install a plugin (marketplace name, local path, or interactive pick)")
    .option("--from <market>", "Marketplace name (when multiple match)")
    .option("--tool <toolId>", "Target AI tool (default: all installed)")
    .option("--token <value>", "Auth token (host detected from source URL at fetch time)")
    .option("--scope <user|project>", "Install scope; must match the tool's supported scope")
    .option("--yes", "Auto-resolve interactive prompts (CI mode)")
    .action(
      async (
        pluginArg: string | undefined,
        cmdOptions: {
          from?: string;
          tool?: string;
          token?: string;
          scope?: string;
          yes?: boolean;
        }
      ) => {
        const { verbose, output, projectRoot } = parseGlobalOptions(program);
        try {
          const toolIds = parseToolOption(cmdOptions.tool, catalog);
          const scope = parseScope(cmdOptions.scope);
          const deps = await createDeps(projectRoot, { verbose, token: cmdOptions.token }, output);
          const result = await deps.pluginInstallUseCase.execute({
            pluginArg,
            toolIds,
            projectRoot,
            interactive: process.stdout.isTTY,
            fromMarketplace: cmdOptions.from,
            yes: cmdOptions.yes,
            scope,
          });
          reportNativeActivation(
            output,
            await deps.syncNativeActivation.execute({
              projectRoot,
              marketplaceNames: cmdOptions.from !== undefined ? [cmdOptions.from] : undefined,
            })
          );
          printPluginInstallOutcome(output, result);
        } catch (error) {
          failCommand(output, error);
        }
      }
    );

  plugin
    .command("search <query>")
    .description("Search registered marketplaces for plugins")
    .option("--recommended", "Show only recommended plugins")
    .option("--marketplace <name>", "Limit to a single marketplace")
    .action(async (query: string, cmdOptions: { recommended?: boolean; marketplace?: string }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const { hits } = await deps.searchPlugins.execute({
          query,
          recommendedOnly: cmdOptions.recommended ?? false,
          marketplace: cmdOptions.marketplace,
          projectRoot,
        });
        printSearchHits(output, hits);
      } catch (error) {
        failCommand(output, error);
      }
    });

  plugin
    .command("update [name]")
    .description("Update one or all plugins for one or all AI tools")
    .option("--tool <toolId>", "Target AI tool (default: all installed)")
    .option("--scope <user|project>", "Update scope (default: project)")
    .action(async (name: string | undefined, cmdOptions: { tool?: string; scope?: string }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      try {
        const toolIds = parseToolOption(cmdOptions.tool, catalog);
        const scope = parseScope(cmdOptions.scope) ?? "project";
        const deps = await createDeps(projectRoot, { verbose }, output);
        const updated = await (scope === "user"
          ? deps.userPluginUpdateUseCase
          : deps.pluginUpdateUseCase
        ).execute({
          pluginNames: name !== undefined ? [name] : undefined,
          toolIds,
          projectRoot,
          scope,
        });
        if (scope === "project") {
          reportNativeActivation(output, await deps.syncNativeActivation.execute({ projectRoot }));
        }
        printPluginsUpdated(output, updated);
      } catch (error) {
        failCommand(output, error);
      }
    });
}
