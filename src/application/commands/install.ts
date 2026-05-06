import type { Command } from "commander";
import { Manifest } from "../../domain/models/manifest.js";
import type { AiToolId, IdeToolId, ToolId } from "../../domain/models/tool-ids.js";
import type { ToolCategory } from "../../domain/tools/registry.js";
import {
  assertToolIdsMatchCategory,
  assertValidToolIds,
  getToolConfig,
  isAiTool,
  toolIdsForCategory,
  VALID_TOOL_IDS,
} from "../../domain/tools/registry.js";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import type { InstallIdeConfigResult } from "../use-cases/install/install-ide-config-use-case.js";
import type { InstallRuntimeConfigResult } from "../use-cases/install/install-runtime-config-use-case.js";
import { parseCategoryArg, parseGlobalOptions } from "./global-options.js";

function resolveInstallArgs(
  categoryArg: string | undefined,
  toolArgs: string[],
  cmdOptions: { all: boolean },
  output: ReturnType<typeof parseGlobalOptions>["output"]
): { category: ToolCategory | undefined; toolIds: ToolId[] | undefined } {
  const category = parseCategoryArg(categoryArg, output);

  if (cmdOptions.all && toolArgs.length > 0) {
    output.warn(`--all is set; ignoring specified tools: ${toolArgs.join(", ")}`);
  }

  if (toolArgs.length > 0 && !cmdOptions.all) {
    assertValidToolIds(toolArgs);
    if (category) assertToolIdsMatchCategory(toolArgs as ToolId[], category);
  }

  if (cmdOptions.all) {
    const allIds = category ? [...toolIdsForCategory(category)] : [...VALID_TOOL_IDS];
    return { category, toolIds: allIds };
  }

  const toolIds: ToolId[] | undefined = toolArgs.length > 0 ? (toolArgs as ToolId[]) : undefined;

  return { category, toolIds };
}

async function installFromAssets(
  toolIds: ToolId[],
  manifest: Manifest,
  projectRoot: string,
  force: boolean,
  version: string,
  deps: Awaited<ReturnType<typeof createDeps>>
): Promise<(InstallRuntimeConfigResult | InstallIdeConfigResult)[]> {
  const results: (InstallRuntimeConfigResult | InstallIdeConfigResult)[] = [];
  for (const toolId of toolIds) {
    const config = getToolConfig(toolId);
    if (isAiTool(config)) {
      results.push(
        await deps.installRuntimeConfigUseCase.execute({
          toolId: toolId as AiToolId,
          projectRoot,
          manifest,
          force,
          version,
        })
      );
    } else {
      results.push(
        await deps.installIdeConfigUseCase.execute({
          toolId: toolId as IdeToolId,
          projectRoot,
          manifest,
          force,
          version,
        })
      );
    }
  }
  return results;
}

export function registerInstallCommand(program: Command): void {
  program
    .command("install")
    .description("Install tool runtime configuration from bundled assets")
    .argument("[category]", "Category to install: ai or ide")
    .argument("[tool...]", "Tool IDs to install (e.g. claude cursor vscode)")
    .addHelpText(
      "after",
      `
Examples:
  aidd install ai claude          Install a specific AI tool
  aidd install ide vscode         Install a specific IDE integration
  aidd install ai claude cursor   Install multiple AI tools
  aidd install ai --all           Install all AI tools
  aidd install --all              Install all tools`
    )
    .option("-f, --force", "Overwrite already-installed tool", false)
    .option("-a, --all", "Install all available tools", false)
    .option("--mcp <servers>", "Comma-separated list of MCP servers to install")
    .option("--plugins <names>", "Comma-separated plugin names from catalog to install")
    .option("--all-plugins", "Install all plugins from catalog", false)
    .option("--recommended-plugins", "Install only recommended plugins from catalog", false)
    .option("--no-plugins", "Skip plugin installation entirely")
    .action(
      async (
        categoryArg: string | undefined,
        toolArgs: string[],
        cmdOptions: {
          force: boolean;
          all: boolean;
          mcp?: string;
          plugins?: string | boolean;
          allPlugins: boolean;
          recommendedPlugins: boolean;
        }
      ) => {
        const { verbose, output, projectRoot } = parseGlobalOptions(program);
        const errorHandler = new ErrorHandler(output);

        if (!cmdOptions.all && !categoryArg && toolArgs.length === 0 && !process.stdout.isTTY) {
          output.error("aidd install requires tool arguments or --all in non-interactive mode.");
          process.exit(1);
        }

        const pluginFlagCount =
          (typeof cmdOptions.plugins === "string" ? 1 : 0) +
          (cmdOptions.allPlugins ? 1 : 0) +
          (cmdOptions.recommendedPlugins ? 1 : 0);
        if (pluginFlagCount > 1) {
          output.error(
            "--plugins, --all-plugins, and --recommended-plugins are mutually exclusive."
          );
          process.exit(1);
        }

        try {
          const { toolIds } = resolveInstallArgs(categoryArg, toolArgs, cmdOptions, output);

          const deps = await createDeps(projectRoot, { verbose }, output);

          const resolvedIds = toolIds ?? [];
          if (resolvedIds.length === 0) {
            output.error("Specify tools to install or use --all.");
            process.exit(1);
          }
          const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
          const version = deps.currentVersionProvider.get();
          const results = await installFromAssets(
            resolvedIds,
            manifest,
            projectRoot,
            cmdOptions.force,
            version,
            deps
          );

          const skipped = results.filter((r) => r.skipped);
          const installed = results.filter((r) => !r.skipped);

          for (const result of skipped) {
            output.warn(`${result.toolId} is already installed. Use \`--force\` to reinstall.`);
          }
          for (const result of installed) {
            for (const warning of result.warnings) {
              output.warn(warning);
            }
          }

          if (installed.length === 0) return;

          const totalFiles = installed.reduce((sum, r) => sum + r.fileCount, 0);
          if (verbose) {
            for (const result of installed) {
              output.debug(`Tool: ${result.toolId}`);
              for (const file of result.files) {
                output.debug(`  + ${file.relativePath}`);
              }
            }
          }
          if (installed.length === 1) {
            output.success(`Installed ${installed[0].toolId} (${installed[0].fileCount} files)`);
          } else {
            const toolList = installed.map((r) => r.toolId).join(", ");
            output.success(`Installed ${toolList} (${totalFiles} files)`);
          }

          const registrationResult = await deps.marketplaceRegisterFrameworkUseCase.execute({
            projectRoot,
          });
          if (process.env.AIDD_SKIP_MARKETPLACE_REFRESH !== "1") {
            await deps.marketplaceRefreshUseCase.execute({ projectRoot });
          }
          if (registrationResult.registered) {
            output.info(
              "Plugin marketplace ready. Run `aidd plugin pick` to browse and install plugins."
            );
          }

          if (process.stdout.isTTY) {
            const marketplaces = await deps.marketplaceRegistry.list(projectRoot);
            if (marketplaces.length > 0) {
              const proceed = await deps.prompter.confirm(
                "Browse marketplaces and install plugins now?"
              );
              if (proceed) {
                await deps.pluginPickUseCase.execute({
                  toolIds: "all",
                  projectRoot,
                  interactive: true,
                });
              }
            }
          }
        } catch (error) {
          errorHandler.handle(error);
        }
      }
    );
}
