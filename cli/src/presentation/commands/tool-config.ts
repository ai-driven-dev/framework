import type { Command } from "commander";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { Deps, DepsSliceFactory } from "../../orchestration/deps.js";
import type { Output } from "../../orchestration/domain/output.js";
import type { AiToolId, IdeToolId, ToolId } from "../../shared/domain/tool.js";
import {
  printInstalledRules,
  printInstalledRulesJson,
} from "../display/installed-rules-display.js";
import { reportNativeActivation } from "../display/sync-display.js";
import {
  printToolAlreadyInstalled,
  printToolInstalled,
  printToolRemoved,
  printUpdateResult,
} from "../display/tool-config-display.js";
import { parseGlobalOptions } from "./global-options.js";
import { type RecipesKeys, registerRecipesCommand } from "./recipes.js";

/** What this command reads of the graph. */
type ToolConfigKeys =
  | "currentVersionProvider"
  | "installAiToolUseCase"
  | "installIdeToolUseCase"
  | "uninstallTools"
  | "updateToolsUseCase"
  | "listInstalledRulesUseCase";

export function assertKnownToolId(raw: string, catalog: ToolCatalog): ToolId {
  const toolId = catalog.toolId(raw);
  if (toolId === null) {
    throw new Error(
      `Unknown tool: ${raw}. Valid tools: ${catalog.idsInCanonicalOrder().join(", ")}`
    );
  }
  return toolId;
}

interface ToolRun {
  deps: Pick<Deps, ToolConfigKeys>;
  output: Output;
  projectRoot: string;
}

async function installTool({
  raw,
  cmdOptions,
  catalog,
  ...run
}: ToolRun & {
  raw: string;
  cmdOptions: { force: boolean; plugins: boolean };
  catalog: ToolCatalog;
}): Promise<void> {
  const toolId = assertKnownToolId(raw, catalog);
  if (catalog.isAiTool(toolId)) {
    await installAiTool({ ...run, toolId, cmdOptions });
  } else {
    await installIdeTool({ ...run, toolId, cmdOptions });
  }
}

async function installAiTool({
  deps,
  output,
  projectRoot,
  toolId,
  cmdOptions,
}: ToolRun & {
  toolId: AiToolId;
  cmdOptions: { force: boolean; plugins: boolean };
}): Promise<void> {
  const version = deps.currentVersionProvider.get();
  const result = await deps.installAiToolUseCase.execute({
    toolId,
    projectRoot,
    force: cmdOptions.force,
    version,
    propagatePlugins: cmdOptions.plugins,
  });
  if (result.runtimeResult.skipped) {
    printToolAlreadyInstalled(output, toolId);
    return;
  }
  printToolInstalled(output, {
    toolId,
    fileCount: result.runtimeResult.fileCount,
    warnings: [...result.runtimeResult.warnings, ...result.propagationWarnings],
  });
  if (result.activation !== undefined) reportNativeActivation(output, result.activation);
}

async function installIdeTool({
  deps,
  output,
  projectRoot,
  toolId,
  cmdOptions,
}: ToolRun & { toolId: IdeToolId; cmdOptions: { force: boolean } }): Promise<void> {
  const version = deps.currentVersionProvider.get();
  const result = await deps.installIdeToolUseCase.execute({
    toolId,
    projectRoot,
    force: cmdOptions.force,
    version,
  });
  if (result.skipped) {
    printToolAlreadyInstalled(output, result.toolId);
    return;
  }
  printToolInstalled(output, {
    toolId: result.toolId,
    fileCount: result.fileCount,
    warnings: result.warnings,
  });
}

async function removeTool({
  deps,
  output,
  projectRoot,
  raw,
  catalog,
}: ToolRun & { raw: string; catalog: ToolCatalog }): Promise<void> {
  const toolId = assertKnownToolId(raw, catalog);

  const results = await deps.uninstallTools.execute({
    toolIds: [toolId],
    projectRoot,
  });
  const totalFileCount = results.reduce((sum, r) => sum + r.fileCount, 0);
  printToolRemoved(output, results[0].toolId, totalFileCount);
}

async function updateTools({
  deps,
  output,
  projectRoot,
  raw,
  cmdOptions,
  catalog,
}: ToolRun & {
  raw: string | undefined;
  cmdOptions: { force: boolean };
  catalog: ToolCatalog;
}): Promise<void> {
  const toolId = raw === undefined ? undefined : assertKnownToolId(raw, catalog);
  const interactive = process.stdout.isTTY ?? false;

  const result = await deps.updateToolsUseCase.execute({
    toolArg: toolId,
    projectRoot,
    userForce: cmdOptions.force,
    interactive,
  });
  printUpdateResult(output, result.updatedTools, result.errors);
}

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
