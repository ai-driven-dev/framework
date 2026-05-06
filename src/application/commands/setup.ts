import type { Command } from "commander";
import { MarketplaceSourceMode } from "../../domain/models/marketplace-source-mode.js";
import { SetupFlow } from "../../domain/models/setup-flow.js";
import {
  AI_TOOL_IDS,
  assertToolIdsMatchCategory,
  IDE_TOOL_IDS,
  type ToolId,
} from "../../domain/tools/registry.js";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import type { CLIOutput } from "../output.js";
import { SetupMarketplaceSourceUseCase } from "../use-cases/setup/setup-marketplace-source-use-case.js";
import { SetupPluginsPromptUseCase } from "../use-cases/setup/setup-plugins-prompt-use-case.js";
import { SetupToolsUseCase } from "../use-cases/setup/setup-tools-use-case.js";
import type { ToolInstallResult } from "../use-cases/setup-use-case.js";
import { SetupUseCase } from "../use-cases/setup-use-case.js";
import { parseGlobalOptions } from "./global-options.js";

interface SetupCmdOptions {
  source?: "remote" | "local";
  path?: string;
  ai?: string;
  ide?: string;
  all?: boolean;
  plugins?: string;
  allPlugins?: boolean;
  recommendedPlugins?: boolean;
  noPlugins?: boolean;
  yes?: boolean;
}

function parseSourceFlag(
  cmdOptions: SetupCmdOptions,
  output: CLIOutput
): MarketplaceSourceMode | undefined {
  if (!cmdOptions.source) return undefined;
  if (cmdOptions.source === "local") {
    if (!cmdOptions.path) {
      output.error("--source local requires --path <absolute-dir>");
      process.exit(1);
    }
    return MarketplaceSourceMode.local(cmdOptions.path);
  }
  return MarketplaceSourceMode.remote();
}

function parseToolIds(
  cmdOptions: SetupCmdOptions,
  errorHandler: ErrorHandler
): { aiTools: ToolId[]; ideTools: ToolId[] } | null {
  if (cmdOptions.all) {
    return { aiTools: [...AI_TOOL_IDS], ideTools: [...IDE_TOOL_IDS] };
  }
  const aiIds =
    cmdOptions.ai
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const ideIds =
    cmdOptions.ide
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  try {
    if (aiIds.length > 0) assertToolIdsMatchCategory(aiIds as ToolId[], "ai");
    if (ideIds.length > 0) assertToolIdsMatchCategory(ideIds as ToolId[], "ide");
  } catch (e) {
    errorHandler.handle(e);
    return null;
  }
  return { aiTools: aiIds as ToolId[], ideTools: ideIds as ToolId[] };
}

function validatePluginFlags(cmdOptions: SetupCmdOptions, output: CLIOutput): void {
  const count =
    (cmdOptions.plugins ? 1 : 0) +
    (cmdOptions.allPlugins ? 1 : 0) +
    (cmdOptions.recommendedPlugins ? 1 : 0) +
    (cmdOptions.noPlugins ? 1 : 0);
  if (count > 1) {
    output.error(
      "--plugins, --all-plugins, --recommended-plugins, and --no-plugins are mutually exclusive."
    );
    process.exit(1);
  }
}

function displayInstall(
  output: CLIOutput,
  results: readonly ToolInstallResult[],
  verbose: boolean
): void {
  const skipped = results.filter((r) => r.skipped);
  const installed = results.filter((r) => !r.skipped);
  for (const r of skipped) output.warn(`${r.toolId} is already installed.`);
  for (const r of installed) for (const w of r.warnings) output.warn(w);
  if (verbose) {
    for (const r of installed) {
      output.debug(`Tool: ${r.toolId}`);
      for (const f of r.files) output.debug(`  + ${f.relativePath}`);
    }
  }
  if (installed.length === 1) {
    output.success(`Installed ${installed[0].toolId} (${installed[0].fileCount} files)`);
  } else if (installed.length > 1) {
    const total = installed.reduce((s, r) => s + r.fileCount, 0);
    output.success(`Installed ${installed.map((r) => r.toolId).join(", ")} (${total} files)`);
  }
}

export function registerSetupCommand(program: Command): void {
  program
    .command("setup")
    .description("Set up or update the project to a correct state")
    .option("--source <mode>", "Framework source: remote or local")
    .option("--path <dir>", "Absolute path to local framework (required with --source local)")
    .option("--ai <ids>", "Comma-separated AI tool IDs (e.g., claude,cursor)")
    .option("--ide <ids>", "Comma-separated IDE tool IDs (e.g., vscode)")
    .option("--all", "Install all available tools (AI + IDE)")
    .option("--plugins <names>", "Comma-separated plugin names to install")
    .option("--all-plugins", "Install all available plugins")
    .option("--recommended-plugins", "Install only recommended plugins")
    .option("--no-plugins", "Skip plugin installation")
    .option("--yes", "Accept defaults without prompting")
    .action(async (cmdOptions: SetupCmdOptions) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      validatePluginFlags(cmdOptions, output);

      const source = parseSourceFlag(cmdOptions, output);
      const toolIds = parseToolIds(cmdOptions, errorHandler);
      if (toolIds === null) return;

      const hasScriptingFlags = !!(
        cmdOptions.source ||
        cmdOptions.all ||
        cmdOptions.ai ||
        cmdOptions.ide ||
        cmdOptions.yes
      );
      const interactive = process.stdout.isTTY && !hasScriptingFlags;

      const pluginMode = resolvePluginMode(cmdOptions, interactive);
      const pluginNames = cmdOptions.plugins
        ? cmdOptions.plugins
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      const flow = new SetupFlow({
        projectRoot,
        source,
        aiTools: toolIds.aiTools,
        ideTools: toolIds.ideTools,
        pluginMode,
        pluginNames,
        interactive,
        force: false,
      });

      try {
        const deps = await createDeps(projectRoot, { verbose }, output);

        const setupMarketplaceSourceUseCase = new SetupMarketplaceSourceUseCase(deps.prompter);
        const setupToolsUseCase = new SetupToolsUseCase(
          deps.manifestRepo,
          deps.installRuntimeConfigUseCase,
          deps.installIdeConfigUseCase
        );
        const setupPluginsPromptUseCase = new SetupPluginsPromptUseCase(
          deps.pluginPickUseCase,
          deps.pluginInstallFromMarketplaceUseCase,
          deps.marketplaceRegistry,
          deps.resolveMarketplaceUseCase
        );

        const result = await new SetupUseCase(
          deps.fs,
          deps.manifestRepo,
          setupMarketplaceSourceUseCase,
          deps.marketplaceRegisterFrameworkUseCase,
          deps.marketplaceRefreshUseCase,
          deps.marketplaceSyncSettingsUseCase,
          setupToolsUseCase,
          setupPluginsPromptUseCase,
          deps.currentVersionProvider
        ).execute(flow);

        switch (result.kind) {
          case "initialized": {
            output.success(`Initialized docs directory ${result.docsDir}/`);
            displayInstall(output, result.install.results, verbose);
            break;
          }
          case "up-to-date": {
            output.info("Project is up to date.");
            displayInstall(output, result.install.results, verbose);
            break;
          }
        }
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}

function resolvePluginMode(
  cmdOptions: SetupCmdOptions,
  interactive: boolean
): "interactive" | "all" | "recommended" | "named" | "none" {
  if (cmdOptions.noPlugins) return "none";
  if (cmdOptions.allPlugins) return "all";
  if (cmdOptions.recommendedPlugins) return "recommended";
  if (cmdOptions.plugins) return "named";
  if (interactive) return "interactive";
  return "none";
}
