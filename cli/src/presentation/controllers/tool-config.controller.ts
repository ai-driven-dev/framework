import type { Command } from "commander";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { DepsSliceFactory } from "../../orchestration/deps.js";
import {
  printInstalledRules,
  printInstalledRulesJson,
} from "../presenters/installed-rules.presenter.js";
import { parseGlobalOptions } from "./global-options.controller.js";
import { type RecipesKeys, registerRecipesCommand } from "./recipes.controller.js";
import type { ToolConfigKeys } from "./tool-config-run.controller.js";
import { installTool } from "./tool-install.controller.js";
import { removeTool, updateTools } from "./tool-maintain.controller.js";

interface ToolConfigWiring {
  readonly catalog: ToolCatalog;
  readonly createDeps: DepsSliceFactory<ToolConfigKeys | RecipesKeys>;
}

function registerInstall(
  program: Command,
  toolConfig: Command,
  { catalog, createDeps }: ToolConfigWiring
): void {
  toolConfig
    .command("install")
    .description(
      "Install a tool's runtime configuration from bundled assets — acts on the framework alone (see `setup`, which bootstraps the whole project)"
    )
    .requiredOption("--tool <tool>", "AI or IDE tool ID")
    .option("-f, --force", "Overwrite already-installed tool", false)
    .option("--no-plugins", "Skip propagation of already-installed plugins onto the new tool")
    .action(async (cmdOptions: { tool: string; force: boolean; plugins: boolean }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const deps = await createDeps(projectRoot, { verbose }, output);
      await installTool({
        deps,
        output,
        projectRoot,
        raw: cmdOptions.tool,
        cmdOptions,
        catalog,
      });
    });
}

function registerRemove(
  program: Command,
  toolConfig: Command,
  { catalog, createDeps }: ToolConfigWiring
): void {
  toolConfig
    .command("remove")
    .description(
      "Remove a tool's generated configuration files — removes the framework only (see `clean`, which removes all of AIDD)"
    )
    .requiredOption("--tool <tool>", "AI or IDE tool ID")
    .action(async (cmdOptions: { tool: string }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const deps = await createDeps(projectRoot, { verbose }, output);
      await removeTool({ deps, output, projectRoot, raw: cmdOptions.tool, catalog });
    });
}

function registerUpdate(
  program: Command,
  toolConfig: Command,
  { catalog, createDeps }: ToolConfigWiring
): void {
  toolConfig
    .command("update")
    .description(
      "Re-install tool configs from bundled CLI assets, moving to a new version (all installed tools if --tool is omitted; see `marketplace refresh`, which re-fetches catalogs instead)"
    )
    .option("--tool <tool>", "Limit update to a specific AI or IDE tool")
    .option("-f, --force", "Overwrite modified files without prompting", false)
    .action(async (cmdOptions: { tool?: string; force: boolean }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const deps = await createDeps(projectRoot, { verbose }, output);
      await updateTools({
        deps,
        output,
        projectRoot,
        raw: cmdOptions.tool,
        cmdOptions,
        catalog,
      });
    });
}

function registerRules(
  program: Command,
  toolConfig: Command,
  createDeps: DepsSliceFactory<ToolConfigKeys | RecipesKeys>
): void {
  toolConfig
    .command("rules")
    .description("List the rules installed in this project, across every AI tool")
    .option("--json", "Print the inventory as JSON")
    .action(async (cmdOptions: { json?: boolean }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const deps = await createDeps(projectRoot, { verbose }, output);
      const { rules } = await deps.listInstalledRulesUseCase.execute({
        projectRoot,
      });
      if (cmdOptions.json) printInstalledRulesJson(output, rules);
      else printInstalledRules(output, rules);
    });
}

export function registerToolConfigCommand(
  program: Command,
  catalog: ToolCatalog,
  createDeps: DepsSliceFactory<ToolConfigKeys | RecipesKeys>
): void {
  const toolConfig = program
    .command("framework")
    .description("Manage the framework's lifecycle on installed tools");

  const wiring = { catalog, createDeps };
  registerInstall(program, toolConfig, wiring);
  registerRemove(program, toolConfig, wiring);
  registerUpdate(program, toolConfig, wiring);
  registerRules(program, toolConfig, createDeps);
  registerRecipesCommand(toolConfig, program, createDeps);
}
