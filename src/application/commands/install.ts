import type { Command } from "commander";
import {
  assertToolIdsMatchCategory,
  assertValidToolIds,
  type ToolCategory,
  type ToolId,
  toolIdsForCategory,
  VALID_TOOL_IDS,
} from "../../domain/tools/registry.js";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { InstallUseCase, type PluginMode } from "../use-cases/install/install-use-case.js";
import { ResolveFrameworkUseCase } from "../use-cases/resolve-framework-use-case.js";
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

export function registerInstallCommand(program: Command): void {
  program
    .command("install")
    .description("Generate tool-specific distributions from the framework")
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
    .option("--path <path>", "Path to a local framework directory or tarball")
    .option("--release <tag>", "Specific framework release tag to install (e.g., v3.2.0)")
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
          path?: string;
          release?: string;
          mcp?: string;
          plugins?: string | boolean;
          allPlugins: boolean;
          recommendedPlugins: boolean;
        }
      ) => {
        const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
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
          const { category, toolIds } = resolveInstallArgs(
            categoryArg,
            toolArgs,
            cmdOptions,
            output
          );

          const deps = await createDeps(projectRoot, { verbose, repo }, output);

          const { path: frameworkPath, version } = await new ResolveFrameworkUseCase(
            deps.resolver,
            deps.logger,
            deps.authReader
          ).execute({ path: cmdOptions.path, release: cmdOptions.release });

          const installUseCase = new InstallUseCase(
            deps.fs,
            deps.manifestRepo,
            deps.loader,
            deps.hasher,
            deps.logger,
            deps.git,
            deps.platform,
            deps.prompter,
            deps.pluginFetcher,
            deps.pluginDistributionReader,
            deps.pluginCatalogRepository
          );

          const mcpFilter = cmdOptions.mcp?.split(",").map((s) => s.trim()) ?? [];
          let pluginMode: PluginMode | undefined;
          let pluginNames: string[] | undefined;
          if (cmdOptions.plugins === false) {
            pluginMode = "none";
          } else if (typeof cmdOptions.plugins === "string") {
            pluginMode = "named";
            pluginNames = cmdOptions.plugins
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          } else if (cmdOptions.allPlugins) {
            pluginMode = "all";
          } else if (cmdOptions.recommendedPlugins) {
            pluginMode = "recommended";
          }

          const results = await installUseCase.execute({
            toolIds,
            category,
            frameworkPath,
            version,
            projectRoot,
            force: cmdOptions.force,
            repo,
            interactive: process.stdout.isTTY,
            mcpFilter,
            pluginMode,
            pluginNames,
          });

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
