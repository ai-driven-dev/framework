import type { Command } from "commander";
import { assertValidToolIds, type ToolId } from "../../domain/models/tool-config.js";
import { createDeps } from "../../infrastructure/deps.js";
import { CLIOutput } from "../output.js";
import { InstallUseCase } from "../use-cases/install-use-case.js";
import { resolveFramework } from "../use-cases/resolve-framework-use-case.js";

export function registerInstallCommand(program: Command): void {
  program
    .command("install")
    .description("Generate tool-specific distributions from the framework")
    .argument("[tools...]", "Tool IDs to operate on (e.g., claude, cursor, copilot)")
    .option("-f, --force", "Overwrite already-installed tool", false)
    .option("-a, --all", "Install all available tools", false)
    .option("--path <path>", "Path to a local framework directory or tarball")
    .option("--release <tag>", "Specific framework release tag to install (e.g., v3.2.0)")
    .action(
      async (
        toolArgs: string[],
        cmdOptions: { force: boolean; all: boolean; path?: string; release?: string }
      ) => {
        const globalOptions = program.opts<{
          verbose: boolean;
          repo?: string;
          token?: string;
        }>();

        const verbose = globalOptions.verbose ?? false;
        const output = new CLIOutput(verbose);
        const projectRoot = process.cwd();

        if (cmdOptions.all && toolArgs.length > 0) {
          output.warn(`--all is set; ignoring specified tools: ${toolArgs.join(", ")}`);
        }

        if (!cmdOptions.all && toolArgs.length === 0 && !process.stdout.isTTY) {
          output.error("aidd install requires tool arguments or --all in non-interactive mode.");
          process.exit(1);
        }

        try {
          if (toolArgs.length > 0 && !cmdOptions.all) {
            assertValidToolIds(toolArgs as ToolId[]);
          }

          const deps = await createDeps(
            projectRoot,
            {
              verbose,
              repo: globalOptions.repo,
              token: globalOptions.token,
            },
            output
          );

          const { path: frameworkPath, version } = await resolveFramework(
            deps.resolver,
            deps.logger,
            { path: cmdOptions.path, release: cmdOptions.release }
          );

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

          const results = await installUseCase.execute({
            toolIds,
            all: cmdOptions.all,
            frameworkPath,
            version,
            projectRoot,
            force: cmdOptions.force,
            repo: globalOptions.repo,
            interactive: process.stdout.isTTY,
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
          output.info("Run `aidd status` to inspect your installation.");
        } catch (error) {
          output.exit(error);
        }
      }
    );
}
