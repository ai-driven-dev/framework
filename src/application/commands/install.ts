import type { Command } from "commander";
import { type ToolId, VALID_TOOL_IDS } from "../../domain/models/tool-config.js";
import { createDeps } from "../../infrastructure/deps.js";
import { printError, printSuccess, printVerbose, printWarning } from "../output.js";
import { ensureInitialized } from "../use-cases/ensure-initialized-use-case.js";
import { GitignoreUseCase } from "../use-cases/gitignore-use-case.js";
import { InstallUseCase } from "../use-cases/install-use-case.js";
import { resolveFramework } from "../use-cases/resolve-framework-use-case.js";

export function registerInstallCommand(program: Command): void {
  program
    .command("install")
    .description("Generate tool-specific distributions from the framework")
    .argument("[tools...]", "Tool IDs to operate on (e.g., claude, cursor, copilot)")
    .option("-f, --force", "Overwrite already-installed tool", false)
    .option("-a, --all", "Install all available tools", false)
    .action(async (toolArgs: string[], cmdOptions: { force: boolean; all: boolean }) => {
      const globalOptions = program.opts<{
        verbose: boolean;
        repo?: string;
        token?: string;
        framework?: string;
      }>();

      const projectRoot = process.cwd();

      if (!cmdOptions.all && toolArgs.length === 0) {
        printError(
          `Specify at least one tool or use --all. Valid tools: ${VALID_TOOL_IDS.join(", ")}`
        );
        process.exit(1);
      }

      const toolIds: ToolId[] = cmdOptions.all ? [...VALID_TOOL_IDS] : (toolArgs as ToolId[]);

      const invalidTools = toolIds.filter((t) => !VALID_TOOL_IDS.includes(t));
      if (invalidTools.length > 0) {
        for (const toolId of invalidTools) {
          printError(`Unknown tool: ${toolId}. Valid tools: ${VALID_TOOL_IDS.join(", ")}`);
        }
        process.exit(1);
      }

      const verbose = globalOptions.verbose ?? false;

      try {
        const deps = await createDeps(projectRoot, {
          verbose,
          repo: globalOptions.repo,
          token: globalOptions.token,
          framework: globalOptions.framework,
        });
        const { path: frameworkPath, version } = await resolveFramework(
          deps.resolver,
          deps.logger,
          { framework: globalOptions.framework }
        );

        await new GitignoreUseCase(deps.fs).execute(projectRoot, [".aidd/cache/"]);
        const manifest = await ensureInitialized(
          deps.manifestRepo,
          deps.fs,
          deps.loader,
          deps.hasher,
          deps.logger,
          { frameworkPath, version, docsDir: deps.settings.docsDir, projectRoot }
        );

        const docsDir = manifest.docsDir;
        const installUseCase = new InstallUseCase(
          deps.fs,
          deps.manifestRepo,
          deps.loader,
          deps.hasher,
          deps.logger
        );

        const results = await installUseCase.execute({
          toolIds,
          frameworkPath,
          version,
          docsDir,
          projectRoot,
          force: cmdOptions.force,
        });

        const installed = results.filter((r) => !r.skipped);
        const skipped = results.filter((r) => r.skipped);

        for (const result of skipped) {
          printWarning(`${result.toolId} is already installed. Use \`--force\` to reinstall.`);
        }

        if (installed.length === 0) return;

        const totalFiles = installed.reduce((sum, r) => sum + r.fileCount, 0);

        if (installed.length === 1) {
          printSuccess(`Installed ${installed[0].toolId} (${installed[0].fileCount} files)`);
        } else {
          const toolList = installed.map((r) => r.toolId).join(", ");
          printSuccess(`Installed ${toolList} (${totalFiles} files)`);
        }

        if (verbose) {
          for (const result of installed) {
            printVerbose(`Tool: ${result.toolId}`);
            for (const file of result.files) {
              printVerbose(`  + ${file.relativePath}`);
            }
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        printError(msg);
        process.exit(1);
      }
    });
}
