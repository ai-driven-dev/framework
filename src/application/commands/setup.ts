import { resolve } from "node:path";
import type { Command } from "commander";
import { MarketplaceSourceMode } from "../../domain/models/marketplace-source-mode.js";
import { SetupFlow } from "../../domain/models/setup-flow.js";
import {
  AI_TOOL_IDS,
  assertToolIdsMatchCategory,
  IDE_TOOL_IDS,
  type ToolId,
} from "../../domain/tools/registry.js";
import { GitHubReleaseResolverAdapter } from "../../infrastructure/adapters/github-release-resolver-adapter.js";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import type { CLIOutput } from "../output.js";
import { ProjectContextDetectorUseCase } from "../use-cases/setup/project-context-detector-use-case.js";
import { SetupMarketplaceSourceUseCase } from "../use-cases/setup/setup-marketplace-source-use-case.js";
import { SetupPluginsPromptUseCase } from "../use-cases/setup/setup-plugins-prompt-use-case.js";
import { SetupToolsPromptUseCase } from "../use-cases/setup/setup-tools-prompt-use-case.js";
import { SetupToolsUseCase } from "../use-cases/setup/setup-tools-use-case.js";
import type { ToolInstallResult } from "../use-cases/setup-use-case.js";
import { SetupUseCase } from "../use-cases/setup-use-case.js";
import { parseGlobalOptions } from "./global-options.js";

interface SetupCmdOptions {
  source?: "remote" | "local";
  path?: string;
  release?: string;
  ai?: string;
  ide?: string;
  plugins?: string;
  yes?: boolean;
  defaultMarketplace?: boolean;
}

function parseSourceFlag(
  cmdOptions: SetupCmdOptions,
  output: CLIOutput
): MarketplaceSourceMode | undefined {
  if (!cmdOptions.source) return undefined;
  if (cmdOptions.source === "local") {
    if (!cmdOptions.path) {
      output.error("--source local requires --path <dir>");
      process.exit(1);
    }
    return MarketplaceSourceMode.local(resolve(cmdOptions.path));
  }
  return MarketplaceSourceMode.remote(undefined, cmdOptions.release);
}

function expandAllKeyword(raw: string | undefined, all: readonly ToolId[]): ToolId[] {
  if (raw === undefined) return [];
  if (raw.trim() === "all") return [...all];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as ToolId[];
}

function parseToolIds(
  cmdOptions: SetupCmdOptions,
  errorHandler: ErrorHandler
): { aiTools: ToolId[]; ideTools: ToolId[] } | null {
  const aiIds = expandAllKeyword(cmdOptions.ai, AI_TOOL_IDS);
  const ideIds = expandAllKeyword(cmdOptions.ide, IDE_TOOL_IDS);
  try {
    if (aiIds.length > 0 && cmdOptions.ai?.trim() !== "all")
      assertToolIdsMatchCategory(aiIds, "ai");
    if (ideIds.length > 0 && cmdOptions.ide?.trim() !== "all")
      assertToolIdsMatchCategory(ideIds, "ide");
  } catch (e) {
    errorHandler.handle(e);
    return null;
  }
  return { aiTools: aiIds, ideTools: ideIds };
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
    .option("--release <tag>", "Marketplace release tag to fetch (e.g., v1.2.3)")
    .option("--ai <ids>", "Comma-separated AI tool IDs, or 'all' (e.g., claude,cursor or all)")
    .option("--ide <ids>", "Comma-separated IDE tool IDs, or 'all' (e.g., vscode or all)")
    .option(
      "--plugins <mode>",
      "Plugin install mode: none | all | recommended | comma-separated names"
    )
    .option(
      "--no-default-marketplace",
      "Skip auto-registering aidd-framework (no source prompt, no plugin install)"
    )
    .option("--yes", "Accept defaults without prompting")
    .action(async (cmdOptions: SetupCmdOptions) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      const source = parseSourceFlag(cmdOptions, output);
      const toolIds = parseToolIds(cmdOptions, errorHandler);
      if (toolIds === null) return;

      const hasScriptingFlags = !!(
        cmdOptions.source ||
        cmdOptions.release ||
        cmdOptions.ai ||
        cmdOptions.ide ||
        cmdOptions.plugins ||
        cmdOptions.yes
      );
      const interactive = process.stdout.isTTY && !hasScriptingFlags;

      const { mode: pluginMode, names: pluginNames } = parsePluginsFlag(
        cmdOptions.plugins,
        interactive
      );

      const registerDefaultMarketplace = cmdOptions.defaultMarketplace !== false;
      const flow = new SetupFlow({
        projectRoot,
        source,
        aiTools: toolIds.aiTools,
        ideTools: toolIds.ideTools,
        pluginMode,
        pluginNames,
        interactive,
        force: false,
        registerDefaultMarketplace,
      });

      if (interactive) printWelcomeBanner(output);

      try {
        const deps = await createDeps(projectRoot, { verbose }, output);

        const releaseResolver = new GitHubReleaseResolverAdapter(deps.http, deps.authReader);
        const setupMarketplaceSourceUseCase = new SetupMarketplaceSourceUseCase(
          deps.prompter,
          releaseResolver
        );
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
        const setupToolsPromptUseCase = new SetupToolsPromptUseCase(deps.prompter);
        const projectContextDetector = new ProjectContextDetectorUseCase(deps.fs);

        const result = await new SetupUseCase(
          deps.fs,
          deps.manifestRepo,
          setupMarketplaceSourceUseCase,
          deps.marketplaceRegisterFrameworkUseCase,
          deps.marketplaceRefreshUseCase,
          deps.marketplaceSyncSettingsUseCase,
          setupToolsUseCase,
          setupPluginsPromptUseCase,
          deps.currentVersionProvider,
          deps.authReader,
          setupToolsPromptUseCase,
          projectContextDetector
        ).execute(flow);

        if (interactive && result.context !== undefined) {
          output.info(`Detected: ${result.context.describe()}.`);
        }
        switch (result.kind) {
          case "initialized": {
            output.success("Project initialized.");
            displayInstall(output, result.install.results, verbose);
            break;
          }
          case "up-to-date": {
            output.info("Project is up to date.");
            displayInstall(output, result.install.results, verbose);
            break;
          }
        }
        if (interactive) printNextSteps(output, result.install.results.length > 0);
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}

function printWelcomeBanner(output: CLIOutput): void {
  output.print("");
  output.print("AI-Driven Development setup");
  output.print("Wires your AI tools, registers the framework marketplace, installs plugins.");
  output.print("Press Ctrl-C any time to abort.");
  output.print("");
}

function printNextSteps(output: CLIOutput, installedAnything: boolean): void {
  output.print("");
  output.print("Next steps:");
  if (installedAnything) output.print("  aidd ai status          # verify drift");
  output.print("  aidd marketplace list   # see registered marketplaces");
  output.print("  aidd plugin install     # add plugins");
  output.print("  aidd --help             # explore commands");
}

type PluginsMode = "interactive" | "all" | "recommended" | "named" | "none";

function parsePluginsFlag(
  raw: string | undefined,
  interactive: boolean
): { mode: PluginsMode; names: string[] } {
  if (raw === undefined) return { mode: interactive ? "interactive" : "none", names: [] };
  const value = raw.trim();
  if (value === "none") return { mode: "none", names: [] };
  if (value === "all") return { mode: "all", names: [] };
  if (value === "recommended") return { mode: "recommended", names: [] };
  const names = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { mode: "named", names };
}
