import type { Command } from "commander";
import type { SearchPlugins } from "../../../contexts/distribution/application/plugin-source/search-plugins.use-case.js";
import type { ListPlugins } from "../../../contexts/installation/application/plugin/list-plugins.use-case.js";
import { aiToolSelectionOf } from "../../../contexts/tools/contract/ai-tool-selection.model.js";
import type { ToolCatalog } from "../../../contexts/tools/contract/tool-catalog.js";
import {
  printInstalledPlugins,
  printSearchHits,
} from "../../presenters/plugin/plugin.presenter.js";
import {
  type ContainerFactory,
  parseGlobalOptions,
  TOKEN_FLAG_HELP,
} from "../menu/global-options.controller.js";
import {
  type GroupMenuContainer,
  type MenuChoice,
  offerGroupMenu,
  type RunCommand,
} from "../menu/group-menu.controller.js";
import {
  type ChangeContainer,
  type ChangeOptions,
  removePluginFrom,
  updatePluginsFrom,
} from "./plugin-change.controller.js";
import {
  type InstallContainer,
  type InstallOptions,
  installPluginFrom,
} from "./plugin-install.controller.js";

const TOOL_FLAG_HELP = "Target AI tool (default: all installed)";

/** What this command reads of the container. */
export type PluginContainer = InstallContainer &
  ChangeContainer &
  GroupMenuContainer & {
    installation: { listPlugins: Pick<ListPlugins, "execute"> };
    plugin: { searchPlugins: Pick<SearchPlugins, "execute"> };
  };

interface PluginWiring {
  readonly catalog: ToolCatalog;
  readonly containerOf: ContainerFactory<PluginContainer>;
  readonly runCommand: RunCommand;
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
  { catalog, containerOf }: PluginWiring
): void {
  plugin
    .command("remove <name>")
    .description("Remove a plugin from one or all AI tools")
    .option("--tool <toolId>", TOOL_FLAG_HELP)
    .option("--scope <user|project>", "Removal scope (default: project)")
    .action(async (name: string, options: ChangeOptions) =>
      removePluginFrom({ program, catalog, containerOf }, name, options)
    );
}

function registerInstall(
  program: Command,
  plugin: Command,
  { catalog, containerOf }: PluginWiring
): void {
  plugin
    .command("install [plugin]")
    .description("Install a plugin (marketplace name, local path, or interactive pick)")
    .option("--from <market>", "Marketplace name (when multiple match)")
    .option("--tool <toolId>", TOOL_FLAG_HELP)
    .option("--token <value>", TOKEN_FLAG_HELP)
    .option("--scope <user|project>", "Install scope; must match the tool's supported scope")
    .option("--yes", "Auto-resolve interactive prompts (CI mode)")
    .action(async (pluginArg: string | undefined, options: InstallOptions) =>
      installPluginFrom({ program, catalog, containerOf }, pluginArg, options)
    );
}

function registerUpdate(
  program: Command,
  plugin: Command,
  { catalog, containerOf }: PluginWiring
): void {
  plugin
    .command("update [name]")
    .description("Update one or all plugins for one or all AI tools")
    .option("--tool <toolId>", TOOL_FLAG_HELP)
    .option("--scope <user|project>", "Update scope (default: project)")
    .action(async (name: string | undefined, options: ChangeOptions) =>
      updatePluginsFrom({ program, catalog, containerOf }, name, options)
    );
}

function registerList(
  program: Command,
  plugin: Command,
  { catalog, containerOf }: PluginWiring
): void {
  plugin
    .command("list")
    .description("List installed plugins for one or all AI tools")
    .option("--tool <toolId>", TOOL_FLAG_HELP)
    .action(async (cmdOptions: { tool?: string }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const toolIds = aiToolSelectionOf(cmdOptions.tool, catalog);
      const container = await containerOf(projectRoot, { verbose }, output);
      const result = await container.installation.listPlugins.execute({ toolIds });
      printInstalledPlugins(output, result);
    });
}

function registerSearch(
  program: Command,
  plugin: Command,
  containerOf: ContainerFactory<PluginContainer>
): void {
  plugin
    .command("search <query>")
    .description("Search registered marketplaces for plugins")
    .option("--recommended", "Show only recommended plugins")
    .option("--marketplace <name>", "Limit to a single marketplace")
    .action(async (query: string, cmdOptions: { recommended?: boolean; marketplace?: string }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const container = await containerOf(projectRoot, { verbose }, output);
      const { hits } = await container.plugin.searchPlugins.execute({
        query,
        recommendedOnly: cmdOptions.recommended ?? false,
        marketplace: cmdOptions.marketplace,
        projectRoot,
      });
      printSearchHits(output, hits);
    });
}

export function registerPluginCommand(program: Command, wiring: PluginWiring): void {
  const { containerOf, runCommand } = wiring;
  const plugin = program.command("plugin").description("Manage plugins for AI tools");
  offerGroupMenu(plugin, {
    question: "plugin: what do you want to do?",
    choices: MENU,
    containerOf,
    runCommand,
  });
  registerRemove(program, plugin, wiring);
  registerList(program, plugin, wiring);
  registerInstall(program, plugin, wiring);
  registerSearch(program, plugin, containerOf);
  registerUpdate(program, plugin, wiring);
}
