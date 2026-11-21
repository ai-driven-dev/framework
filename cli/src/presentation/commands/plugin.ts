import type { Command } from "commander";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { CommandRunner, DepsSliceFactory } from "../../orchestration/deps.js";
import { aiToolSelectionOf } from "../../orchestration/domain/ai-tool-selection.model.js";
import { printInstalledPlugins, printSearchHits } from "../display/plugin-display.js";
import { parseGlobalOptions } from "./global-options.js";
import { type MenuChoice, offerGroupMenu } from "./group-menu.js";
import {
  type ChangeKeys,
  type ChangeOptions,
  removePluginFrom,
  updatePluginsFrom,
} from "./plugin-change.js";
import { type InstallKeys, type InstallOptions, installPluginFrom } from "./plugin-install.js";

/** What this command reads of the graph. */
type PluginKeys = InstallKeys | ChangeKeys | "prompter" | "pluginListUseCase" | "searchPlugins";

interface PluginWiring {
  readonly catalog: ToolCatalog;
  readonly createDeps: DepsSliceFactory<PluginKeys>;
  readonly runCommand: CommandRunner;
}

const MENU: readonly MenuChoice[] = [
  { name: "Install plugin", value: "install" },
  { name: "List installed plugins", value: "list" },
  { name: "Search plugins", value: "search", description: "requires query arg" },
  { name: "Update plugins", value: "update" },
  { name: "Remove a plugin", value: "remove", description: "requires name arg" },
];

function registerRemove(
  program: Command,
  plugin: Command,
  { catalog, createDeps }: PluginWiring
): void {
  plugin
    .command("remove <name>")
    .description("Remove a plugin from one or all AI tools")
    .option("--tool <toolId>", "Target AI tool (default: all installed)")
    .option("--scope <user|project>", "Removal scope (default: project)")
    .action(async (name: string, options: ChangeOptions) =>
      removePluginFrom({ program, catalog, createDeps }, name, options)
    );
}

function registerInstall(
  program: Command,
  plugin: Command,
  { catalog, createDeps }: PluginWiring
): void {
  plugin
    .command("install [plugin]")
    .description("Install a plugin (marketplace name, local path, or interactive pick)")
    .option("--from <market>", "Marketplace name (when multiple match)")
    .option("--tool <toolId>", "Target AI tool (default: all installed)")
    .option("--token <value>", "Auth token (host detected from source URL at fetch time)")
    .option("--scope <user|project>", "Install scope; must match the tool's supported scope")
    .option("--yes", "Auto-resolve interactive prompts (CI mode)")
    .action(async (pluginArg: string | undefined, options: InstallOptions) =>
      installPluginFrom({ program, catalog, createDeps }, pluginArg, options)
    );
}

function registerUpdate(
  program: Command,
  plugin: Command,
  { catalog, createDeps }: PluginWiring
): void {
  plugin
    .command("update [name]")
    .description("Update one or all plugins for one or all AI tools")
    .option("--tool <toolId>", "Target AI tool (default: all installed)")
    .option("--scope <user|project>", "Update scope (default: project)")
    .action(async (name: string | undefined, options: ChangeOptions) =>
      updatePluginsFrom({ program, catalog, createDeps }, name, options)
    );
}

function registerList(
  program: Command,
  plugin: Command,
  { catalog, createDeps }: PluginWiring
): void {
  plugin
    .command("list")
    .description("List installed plugins for one or all AI tools")
    .option("--tool <toolId>", "Target AI tool (default: all installed)")
    .action(async (cmdOptions: { tool?: string }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const toolIds = aiToolSelectionOf(cmdOptions.tool, catalog);
      const deps = await createDeps(projectRoot, { verbose }, output);
      const result = await deps.pluginListUseCase.execute({
        toolIds,
      });
      printInstalledPlugins(output, result);
    });
}

function registerSearch(
  program: Command,
  plugin: Command,
  createDeps: DepsSliceFactory<PluginKeys>
): void {
  plugin
    .command("search <query>")
    .description("Search registered marketplaces for plugins")
    .option("--recommended", "Show only recommended plugins")
    .option("--marketplace <name>", "Limit to a single marketplace")
    .action(async (query: string, cmdOptions: { recommended?: boolean; marketplace?: string }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const deps = await createDeps(projectRoot, { verbose }, output);
      const { hits } = await deps.searchPlugins.execute({
        query,
        recommendedOnly: cmdOptions.recommended ?? false,
        marketplace: cmdOptions.marketplace,
        projectRoot,
      });
      printSearchHits(output, hits);
    });
}

export function registerPluginCommand(program: Command, wiring: PluginWiring): void {
  const { createDeps, runCommand } = wiring;
  const plugin = program.command("plugin").description("Manage plugins for AI tools");
  offerGroupMenu(plugin, {
    question: "plugin: what do you want to do?",
    choices: MENU,
    createDeps,
    runCommand,
  });
  registerRemove(program, plugin, wiring);
  registerList(program, plugin, wiring);
  registerInstall(program, plugin, wiring);
  registerSearch(program, plugin, createDeps);
  registerUpdate(program, plugin, wiring);
}
