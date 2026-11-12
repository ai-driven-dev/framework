import { join, resolve } from "node:path";
import type { Command } from "commander";
import { Manifest } from "../../contexts/framework/domain/manifest.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { AiToolId, IdeToolId, ToolId } from "../../kernel/tool.js";
import { isAiToolId, isIdeToolId, VALID_TOOL_IDS } from "../../kernel/tool.js";
import { createDeps } from "../../runtime/wiring/framework.js";
import {
  printToolAlreadyInstalled,
  printToolInstalled,
  printToolRemoved,
  printUpdateResult,
  renderRecipeValidation,
} from "../display/framework-display.js";
import {
  printInstalledRules,
  printInstalledRulesJson,
} from "../display/installed-rules-display.js";
import { ErrorHandler } from "../error-handler.js";
import type { CLIOutput } from "../output.js";
import { parseGlobalOptions } from "./global-options.js";
import { reportSyncActivation } from "./sync-native-activation.js";

type Deps = Awaited<ReturnType<typeof createDeps>>;

export function assertKnownToolId(toolId: string): asserts toolId is ToolId {
  if (!isAiToolId(toolId) && !isIdeToolId(toolId)) {
    throw new Error(`Unknown tool: ${toolId}. Valid tools: ${VALID_TOOL_IDS.join(", ")}`);
  }
}

async function runFrameworkInstall(
  deps: Deps,
  output: CLIOutput,
  projectRoot: string,
  toolId: ToolId,
  cmdOptions: { force: boolean; plugins: boolean },
  catalog: ToolCatalog
): Promise<void> {
  assertKnownToolId(toolId);
  if (isAiToolId(toolId)) {
    await installAiTool(deps, output, projectRoot, toolId, cmdOptions, catalog);
  } else {
    await installIdeTool(deps, output, projectRoot, toolId, cmdOptions, catalog);
  }
}

async function installAiTool(
  deps: Deps,
  output: CLIOutput,
  projectRoot: string,
  toolId: AiToolId,
  cmdOptions: { force: boolean; plugins: boolean },
  catalog: ToolCatalog
): Promise<void> {
  const version = deps.currentVersionProvider.get();
  const result = await deps.installAiToolUseCase.execute({
    toolId,
    projectRoot,
    force: cmdOptions.force,
    version,
    propagatePlugins: cmdOptions.plugins,
    tools: catalog.sortedById(),
  });
  if (result.runtimeResult.skipped) {
    printToolAlreadyInstalled(output, toolId);
    return;
  }
  printToolInstalled(output, toolId, result.runtimeResult.fileCount, [
    ...result.runtimeResult.warnings,
    ...result.propagationWarnings,
  ]);
  if (result.activation !== undefined) reportSyncActivation(output, result.activation);
}

async function installIdeTool(
  deps: Deps,
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
    tools: catalog.sortedById(),
  });
  if (result.skipped) {
    printToolAlreadyInstalled(output, result.toolId);
    return;
  }
  printToolInstalled(output, result.toolId, result.fileCount, result.warnings);
}

async function runFrameworkRemove(
  deps: Deps,
  output: CLIOutput,
  projectRoot: string,
  toolId: ToolId,
  catalog: ToolCatalog
): Promise<void> {
  assertKnownToolId(toolId);
  const tools = catalog.sortedById();
  if (isAiToolId(toolId)) {
    const results = await deps.uninstallUseCase.execute({
      toolIds: [toolId],
      projectRoot,
      tools,
    });
    const totalFileCount = results.reduce((sum, r) => sum + r.fileCount, 0);
    printToolRemoved(output, results[0].toolId, totalFileCount);
    return;
  }
  const result = await deps.uninstallIdeUseCase.execute({ toolId, projectRoot, tools });
  printToolRemoved(output, result.toolId, result.fileCount);
}

async function runFrameworkUpdate(
  deps: Deps,
  output: CLIOutput,
  projectRoot: string,
  toolId: ToolId | undefined,
  cmdOptions: { force: boolean },
  catalog: ToolCatalog
): Promise<void> {
  if (toolId !== undefined) assertKnownToolId(toolId);
  const interactive = process.stdout.isTTY ?? false;

  if (toolId !== undefined) {
    if (isAiToolId(toolId)) {
      const result = await deps.updateAiToolsUseCase.execute({
        toolArg: toolId,
        projectRoot,
        userForce: cmdOptions.force,
        interactive,
        tools: catalog.sortedById(),
      });
      printUpdateResult(output, result.updatedTools, result.errors);
    } else {
      const result = await deps.updateIdeToolsUseCase.execute({
        toolArg: toolId as IdeToolId,
        projectRoot,
        userForce: cmdOptions.force,
        interactive,
        tools: catalog.sortedById(),
      });
      printUpdateResult(output, result.updatedTools, result.errors);
    }
    return;
  }

  // No `--tool`: fan out across both categories — every installed AI and IDE tool.
  const ai = await deps.updateAiToolsUseCase.execute({
    projectRoot,
    userForce: cmdOptions.force,
    interactive,
    tools: catalog.sortedById(),
  });
  const ide = await deps.updateIdeToolsUseCase.execute({
    projectRoot,
    userForce: cmdOptions.force,
    interactive,
    tools: catalog.sortedById(),
  });
  printUpdateResult(
    output,
    [...ai.updatedTools, ...ide.updatedTools],
    [...ai.errors, ...ide.errors]
  );
}

export function registerFrameworkCommand(program: Command, catalog: ToolCatalog): void {
  const framework = program
    .command("framework")
    .description("Manage the framework's lifecycle on installed tools");

  framework
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
        const deps = await createDeps(projectRoot, { verbose }, output, catalog);
        await runFrameworkInstall(
          deps,
          output,
          projectRoot,
          cmdOptions.tool as ToolId,
          cmdOptions,
          catalog
        );
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  framework
    .command("remove")
    .description(
      "Remove a tool's generated configuration files — removes the framework only (see `clean`, which removes all of AIDD)"
    )
    .requiredOption("--tool <tool>", "AI or IDE tool ID")
    .action(async (cmdOptions: { tool: string }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output, catalog);
        await runFrameworkRemove(deps, output, projectRoot, cmdOptions.tool as ToolId, catalog);
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  framework
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
        const deps = await createDeps(projectRoot, { verbose }, output, catalog);
        await runFrameworkUpdate(
          deps,
          output,
          projectRoot,
          cmdOptions.tool as ToolId | undefined,
          cmdOptions,
          catalog
        );
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  framework
    .command("rules")
    .description("List the rules installed in this project, across every AI tool")
    .option("--json", "Print the inventory as JSON")
    .action(async (cmdOptions: { json?: boolean }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output, catalog);
        const { rules } = await deps.listInstalledRulesUseCase.execute({
          projectRoot,
          tools: catalog.sortedById(),
        });
        if (cmdOptions.json) printInstalledRulesJson(output, rules);
        else printInstalledRules(output, rules);
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  framework
    .command("validate-recipes [paths...]")
    .description("Validate recipe structure, examples, and local links without changing files")
    .option("--all", "Include project recipes under aidd_docs/recipes", false)
    .option("--bundled <directory>", "Include recipes from this skill asset directory")
    .action(async (paths: string[], options: { all: boolean; bundled?: string }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output, catalog);
        const directories = [];
        if (options.all)
          directories.push({ path: join(projectRoot, "aidd_docs", "recipes"), optional: true });
        if (options.bundled)
          directories.push({ path: resolve(projectRoot, options.bundled), optional: false });
        const result = deps.validateRecipesUseCase.execute({
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
