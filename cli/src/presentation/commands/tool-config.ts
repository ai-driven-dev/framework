import { join, resolve } from "node:path";
import type { Command } from "commander";
import { Manifest } from "../../contexts/installation/domain/manifest.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { AiToolId, IdeToolId, ToolId } from "../../shared/domain/tool.js";
import type { Deps, DepsSliceFactory } from "../deps.js";
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
  renderRecipeValidation,
} from "../display/tool-config-display.js";
import { ErrorHandler } from "../error-handler.js";
import type { CLIOutput } from "../output.js";
import { parseGlobalOptions } from "./global-options.js";

/** What this command reads of the graph. */
type ToolConfigKeys =
  | "currentVersionProvider"
  | "installAiToolUseCase"
  | "manifestRepo"
  | "installIdeToolUseCase"
  | "uninstallTools"
  | "updateToolsUseCase"
  | "listInstalledRulesUseCase"
  | "validateRecipes";

export function assertKnownToolId(raw: string, catalog: ToolCatalog): ToolId {
  const toolId = catalog.toolId(raw);
  if (toolId === null) {
    throw new Error(
      `Unknown tool: ${raw}. Valid tools: ${catalog.idsInCanonicalOrder().join(", ")}`
    );
  }
  return toolId;
}

async function installTool(
  deps: Pick<Deps, ToolConfigKeys>,
  output: CLIOutput,
  projectRoot: string,
  raw: string,
  cmdOptions: { force: boolean; plugins: boolean },
  catalog: ToolCatalog
): Promise<void> {
  const toolId = assertKnownToolId(raw, catalog);
  if (catalog.isAiTool(toolId)) {
    await installAiTool(deps, output, projectRoot, toolId, cmdOptions);
  } else {
    await installIdeTool(deps, output, projectRoot, toolId, cmdOptions, catalog);
  }
}

async function installAiTool(
  deps: Pick<Deps, ToolConfigKeys>,
  output: CLIOutput,
  projectRoot: string,
  toolId: AiToolId,
  cmdOptions: { force: boolean; plugins: boolean }
): Promise<void> {
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
  printToolInstalled(output, toolId, result.runtimeResult.fileCount, [
    ...result.runtimeResult.warnings,
    ...result.propagationWarnings,
  ]);
  if (result.activation !== undefined) reportNativeActivation(output, result.activation);
}

async function installIdeTool(
  deps: Pick<Deps, ToolConfigKeys>,
  output: CLIOutput,
  projectRoot: string,
  toolId: IdeToolId,
  cmdOptions: { force: boolean },
  catalog: ToolCatalog
): Promise<void> {
  const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
  const version = deps.currentVersionProvider.get();
  const result = await deps.installIdeToolUseCase.execute({
    toolId,
    projectRoot,
    manifest,
    force: cmdOptions.force,
    version,
    tools: catalog,
  });
  if (result.skipped) {
    printToolAlreadyInstalled(output, result.toolId);
    return;
  }
  printToolInstalled(output, result.toolId, result.fileCount, result.warnings);
}

async function removeTool(
  deps: Pick<Deps, ToolConfigKeys>,
  output: CLIOutput,
  projectRoot: string,
  raw: string,
  catalog: ToolCatalog
): Promise<void> {
  const toolId = assertKnownToolId(raw, catalog);

  const results = await deps.uninstallTools.execute({
    toolIds: [toolId],
    projectRoot,
  });
  const totalFileCount = results.reduce((sum, r) => sum + r.fileCount, 0);
  printToolRemoved(output, results[0].toolId, totalFileCount);
}

async function updateTools(
  deps: Pick<Deps, ToolConfigKeys>,
  output: CLIOutput,
  projectRoot: string,
  raw: string | undefined,
  cmdOptions: { force: boolean },
  catalog: ToolCatalog
): Promise<void> {
  const toolId = raw === undefined ? undefined : assertKnownToolId(raw, catalog);
  const interactive = process.stdout.isTTY ?? false;

  const result = await deps.updateToolsUseCase.execute({
    toolArg: toolId,
    projectRoot,
    userForce: cmdOptions.force,
    interactive,
    tools: catalog,
  });
  printUpdateResult(output, result.updatedTools, result.errors);
}

export function registerToolConfigCommand(
  program: Command,
  catalog: ToolCatalog,
  createDeps: DepsSliceFactory<ToolConfigKeys>
): void {
  const toolConfig = program
    .command("framework")
    .description("Manage the framework's lifecycle on installed tools");

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
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        await installTool(deps, output, projectRoot, cmdOptions.tool, cmdOptions, catalog);
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  toolConfig
    .command("remove")
    .description(
      "Remove a tool's generated configuration files — removes the framework only (see `clean`, which removes all of AIDD)"
    )
    .requiredOption("--tool <tool>", "AI or IDE tool ID")
    .action(async (cmdOptions: { tool: string }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        await removeTool(deps, output, projectRoot, cmdOptions.tool, catalog);
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  toolConfig
    .command("update")
    .description(
      "Re-install tool configs from bundled CLI assets, moving to a new version (all installed tools if --tool is omitted; see `marketplace refresh`, which re-fetches catalogs instead)"
    )
    .option("--tool <tool>", "Limit update to a specific AI or IDE tool")
    .option("-f, --force", "Overwrite modified files without prompting", false)
    .action(async (cmdOptions: { tool?: string; force: boolean }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        await updateTools(deps, output, projectRoot, cmdOptions.tool, cmdOptions, catalog);
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  toolConfig
    .command("rules")
    .description("List the rules installed in this project, across every AI tool")
    .option("--json", "Print the inventory as JSON")
    .action(async (cmdOptions: { json?: boolean }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const { rules } = await deps.listInstalledRulesUseCase.execute({
          projectRoot,
        });
        if (cmdOptions.json) printInstalledRulesJson(output, rules);
        else printInstalledRules(output, rules);
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  toolConfig
    .command("validate-recipes [paths...]")
    .description("Validate recipe structure, examples, and local links without changing files")
    .option("--all", "Include project recipes under aidd_docs/recipes", false)
    .option("--bundled <directory>", "Include recipes from this skill asset directory")
    .action(async (paths: string[], options: { all: boolean; bundled?: string }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const directories = [];
        if (options.all)
          directories.push({ path: join(projectRoot, "aidd_docs", "recipes"), optional: true });
        if (options.bundled)
          directories.push({ path: resolve(projectRoot, options.bundled), optional: false });
        const result = deps.validateRecipes.execute({
          files: paths.map((file) => resolve(projectRoot, file)),
          directories,
        });
        const report = renderRecipeValidation(result, projectRoot);
        if (result.findings.length === 0) output.success(report);
        else {
          output.error(`\n${report}`);
          process.exitCode = 1;
        }
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}
