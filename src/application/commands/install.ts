import type { Command } from "commander";
import {
  assertToolIdsMatchCategory,
  assertValidToolIds,
  type ToolCategory,
  type ToolId,
} from "../../domain/models/tool-config.js";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { InstallUseCase } from "../use-cases/install-use-case.js";
import { ResolveFrameworkUseCase } from "../use-cases/resolve-framework-use-case.js";
import { parseGlobalOptions } from "./global-options.js";

export function registerInstallCommand(program: Command): void {
  program
    .command("install")
    .description("Generate tool-specific distributions from the framework")
    .argument("[args...]", "Optional category ('ai' or 'ide') followed by tool IDs")
    .option("-f, --force", "Overwrite already-installed tool", false)
    .option("-a, --all", "Install all available tools", false)
    .option("--path <path>", "Path to a local framework directory or tarball")
    .option("--release <tag>", "Specific framework release tag to install (e.g., v3.2.0)")
    .option("--mcp <servers>", "Comma-separated list of MCP servers to install")
    .action(
      async (
        rawArgs: string[],
        cmdOptions: { force: boolean; all: boolean; path?: string; release?: string; mcp?: string }
      ) => {
        const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
        const errorHandler = new ErrorHandler(output);

        const category: ToolCategory | undefined =
          rawArgs[0] === "ai" || rawArgs[0] === "ide" ? rawArgs[0] : undefined;
        const toolArgs = category ? rawArgs.slice(1) : rawArgs;

        if (cmdOptions.all && toolArgs.length > 0) {
          output.warn(`--all is set; ignoring specified tools: ${toolArgs.join(", ")}`);
        }

        try {
          if (toolArgs.length > 0 && !cmdOptions.all) {
            assertValidToolIds(toolArgs);
            if (category) assertToolIdsMatchCategory(toolArgs as ToolId[], category);
          }

          const deps = await createDeps(projectRoot, { verbose, repo }, output);

          if (!cmdOptions.all && toolArgs.length === 0 && !category && !process.stdout.isTTY) {
            output.error("aidd install requires tool arguments or --all in non-interactive mode.");
            process.exit(1);
          }

          const { path: frameworkPath, version } = await new ResolveFrameworkUseCase(
            deps.resolver,
            deps.logger,
            deps.authReader
          ).execute({ path: cmdOptions.path, release: cmdOptions.release });

          const toolIds: ToolId[] | undefined =
            !cmdOptions.all && toolArgs.length > 0 ? (toolArgs as ToolId[]) : undefined;

          const installUseCase = new InstallUseCase(
            deps.fs,
            deps.manifestRepo,
            deps.loader,
            deps.hasher,
            deps.logger,
            deps.git,
            deps.platform,
            deps.prompter
          );

          const mcpFilter = cmdOptions.mcp?.split(",").map((s) => s.trim()) ?? [];

          const results = await installUseCase.execute({
            toolIds,
            all: cmdOptions.all,
            category,
            frameworkPath,
            version,
            projectRoot,
            force: cmdOptions.force,
            repo,
            interactive: process.stdout.isTTY,
            mcpFilter,
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
        } catch (error) {
          errorHandler.handle(error);
        }
      }
    );
}
