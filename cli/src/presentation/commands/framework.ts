import { join, resolve } from "node:path";
import type { Command } from "commander";
import { Manifest } from "../../contexts/framework/domain/manifest.js";
import { isIdeToolId } from "../../contexts/tools/domain/registry.js";
import type { AiToolId, IdeToolId, ToolId } from "../../kernel/tool.js";
import { isAiToolId, VALID_TOOL_IDS } from "../../kernel/tool.js";
import { assertMachineConfigDirectorySupported } from "../../runtime/machine-config-directory.js";
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
type UpgradeOptions = Parameters<Deps["upgradeFrameworkUseCase"]["execute"]>[0];
type FrameworkUpgradePreview = Parameters<UpgradeOptions["confirm"]>[0];

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
  cmdOptions: { force: boolean; plugins: boolean }
): Promise<void> {
  assertKnownToolId(toolId);
  if (isAiToolId(toolId)) {
    await installAiTool(deps, output, projectRoot, toolId, cmdOptions);
  } else {
    await installIdeTool(deps, output, projectRoot, toolId, cmdOptions);
  }
}

async function installAiTool(
  deps: Deps,
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
  if (result.activation !== undefined) reportSyncActivation(output, result.activation);
}

async function installIdeTool(
  deps: Deps,
  output: CLIOutput,
  projectRoot: string,
  toolId: IdeToolId,
  cmdOptions: { force: boolean }
): Promise<void> {
  const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
  const version = deps.currentVersionProvider.get();
  const result = await deps.installIdeToolUseCase.execute({
    toolId,
    projectRoot,
    manifest,
    force: cmdOptions.force,
    version,
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
  toolId: ToolId
): Promise<void> {
  assertKnownToolId(toolId);
  if (isAiToolId(toolId)) {
    const results = await deps.uninstallUseCase.execute({
      toolIds: [toolId],
      projectRoot,
    });
    const totalFileCount = results.reduce((sum, r) => sum + r.fileCount, 0);
    printToolRemoved(output, results[0].toolId, totalFileCount);
    return;
  }
  const result = await deps.uninstallIdeUseCase.execute({ toolId, projectRoot });
  printToolRemoved(output, result.toolId, result.fileCount);
}

async function runFrameworkUpdate(
  deps: Deps,
  output: CLIOutput,
  projectRoot: string,
  toolId: ToolId | undefined,
  cmdOptions: { force: boolean }
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
      });
      printUpdateResult(output, result.updatedTools, result.errors);
    } else {
      const result = await deps.updateIdeToolsUseCase.execute({
        toolArg: toolId as IdeToolId,
        projectRoot,
        userForce: cmdOptions.force,
        interactive,
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
  });
  const ide = await deps.updateIdeToolsUseCase.execute({
    projectRoot,
    userForce: cmdOptions.force,
    interactive,
  });
  printUpdateResult(
    output,
    [...ai.updatedTools, ...ide.updatedTools],
    [...ai.errors, ...ide.errors]
  );
}

function printReleasePreview(
  output: CLIOutput,
  projectRoot: string,
  preview: FrameworkUpgradePreview
): void {
  output.info(`Project: ${projectRoot}`);
  output.info(`Marketplace: ${preview.currentRef} -> ${preview.release}`);
  output.info("Installed project plugins:");
  for (const target of preview.targets) {
    const version = target.targetVersion
      ? `${target.currentVersion} -> ${target.targetVersion}`
      : target.currentVersion;
    output.info(
      `  ${target.toolId}:${target.pluginName} (plugin ${version}; source ${target.currentRef} -> ${preview.release})`
    );
  }
  if (preview.globalSkipped)
    output.info(`${preview.globalSkipped} user-scope plugin entries will not be updated.`);
  if (preview.shared) output.warn("This marketplace is shared; other projects may be affected.");
}

async function runFrameworkReleaseUpdate(
  deps: Deps,
  output: CLIOutput,
  projectRoot: string,
  options: { release: string; yes: boolean; allowShared: boolean }
): Promise<void> {
  const interactive = process.stdout.isTTY ?? false;
  const result = await deps.upgradeFrameworkUseCase.execute({
    projectRoot,
    release: options.release,
    allowShared: options.allowShared || (interactive && !options.yes),
    confirm: async (preview) => {
      printReleasePreview(output, projectRoot, preview);
      if (options.yes) return true;
      if (!interactive)
        throw new Error(
          "A release update requires confirmation; pass --yes after reviewing its impact."
        );
      return deps.prompter.confirm(
        "Update these project plugins and the displayed marketplace?",
        false
      );
    },
  });
  if (result.cancelled) {
    output.info("Update cancelled; no installation changes were made.");
    return;
  }
  output.success(
    `Updated project plugin sources to ${options.release}: ${result.updated.join(", ")}.`
  );
  output.info(
    "Restart the affected tools to load the updated plugins. Session reload and every component were not verified."
  );
}

async function runUserFrameworkReleaseUpdate(
  deps: Deps,
  output: CLIOutput,
  projectRoot: string,
  options: { release: string; yes: boolean }
): Promise<void> {
  assertMachineConfigDirectorySupported();
  const interactive = process.stdout.isTTY ?? false;
  const result = await deps.upgradeUserFrameworkUseCase.execute({
    projectRoot,
    release: options.release,
    confirm: async (preview) => {
      output.info(`Machine release: ${preview.release}`);
      for (const target of preview.targets) {
        output.info(
          `  ${target.toolId}:${target.name} (plugin ${target.currentVersion} -> ${target.targetVersion}; source ${target.currentRef} -> ${preview.release})`
        );
        if (target.dependents.length)
          output.info(`    Dependent projects: ${target.dependents.join(", ")}`);
      }
      if (preview.nativeSkipped)
        output.warn(
          `${preview.nativeSkipped} native plugin claims are not updated by this command.`
        );
      if (options.yes) return true;
      if (!interactive)
        throw new Error(
          "A release update requires confirmation; pass --yes after reviewing its impact."
        );
      return deps.prompter.confirm("Update these machine plugin copies?", false);
    },
  });
  if (result.cancelled) {
    output.info("Update cancelled; no installation changes were made.");
    return;
  }
  output.success(
    `Updated machine plugin sources to ${options.release}: ${result.updated.join(", ")}.`
  );
  output.info(
    "Restart the affected tools to load updated plugins; dependent projects may need a refresh."
  );
}

export function registerFrameworkCommand(program: Command): void {
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
        const deps = await createDeps(projectRoot, { verbose }, output);
        await runFrameworkInstall(deps, output, projectRoot, cmdOptions.tool as ToolId, cmdOptions);
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
        const deps = await createDeps(projectRoot, { verbose }, output);
        await runFrameworkRemove(deps, output, projectRoot, cmdOptions.tool as ToolId);
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  framework
    .command("update")
    .description("Update installed tool configs from the CLI, or plugins with --release")
    .option("--tool <tool>", "Limit update to a specific AI or IDE tool")
    .option("-f, --force", "Overwrite modified files without prompting", false)
    .option("--release <tag>", "Update plugins to a root release, e.g. v5.13.0")
    .option(
      "--scope <project|user>",
      "Choose project or machine plugin installations (with --release)"
    )
    .option("--yes", "Confirm the displayed release update without prompting", false)
    .option("--allow-shared", "Confirm a marketplace change shared with other projects", false)
    .action(
      async (cmdOptions: {
        tool?: string;
        force: boolean;
        release?: string;
        scope?: string;
        yes: boolean;
        allowShared: boolean;
      }) => {
        const { verbose, output, projectRoot } = parseGlobalOptions(program);
        const errorHandler = new ErrorHandler(output);
        try {
          if (!cmdOptions.release && (cmdOptions.yes || cmdOptions.allowShared))
            throw new Error("--yes and --allow-shared require --release.");
          if (
            cmdOptions.scope !== undefined &&
            cmdOptions.scope !== "project" &&
            cmdOptions.scope !== "user"
          )
            throw new Error("--scope must be project or user.");
          if (cmdOptions.scope && !cmdOptions.release)
            throw new Error("--scope requires --release.");
          if (cmdOptions.scope === "user" && cmdOptions.allowShared)
            throw new Error("--allow-shared is not needed for machine plugin copies.");
          if (cmdOptions.release && (cmdOptions.tool || cmdOptions.force))
            throw new Error("--tool and --force cannot be combined with --release.");
          const deps = await createDeps(projectRoot, { verbose }, output);
          if (cmdOptions.release) {
            if (cmdOptions.scope === "user")
              await runUserFrameworkReleaseUpdate(deps, output, projectRoot, {
                release: cmdOptions.release,
                yes: cmdOptions.yes,
              });
            else
              await runFrameworkReleaseUpdate(deps, output, projectRoot, {
                release: cmdOptions.release,
                yes: cmdOptions.yes,
                allowShared: cmdOptions.allowShared,
              });
            return;
          }
          await runFrameworkUpdate(
            deps,
            output,
            projectRoot,
            cmdOptions.tool as ToolId | undefined,
            cmdOptions
          );
        } catch (error) {
          errorHandler.handle(error);
        }
      }
    );

  framework
    .command("rules")
    .description("List the rules installed in this project, across every AI tool")
    .option("--json", "Print the inventory as JSON")
    .action(async (cmdOptions: { json?: boolean }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const { rules } = await deps.listInstalledRulesUseCase.execute({ projectRoot });
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
        const deps = await createDeps(projectRoot, { verbose }, output);
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
