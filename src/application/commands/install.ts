import type { Command } from "commander";
import { type ToolId, VALID_TOOL_IDS } from "../../domain/models/tool-config.js";
import { createDeps } from "../../infrastructure/deps.js";
import { NoManifestError } from "../errors.js";
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
    .action(async (toolArgs: string[], cmdOptions: { force: boolean; all: boolean }) => {
      const globalOptions = program.opts<{
        verbose: boolean;
        repo?: string;
        token?: string;
        framework?: string;
        release?: string;
      }>();

      const verbose = globalOptions.verbose ?? false;
      const output = new CLIOutput(verbose);
      const projectRoot = process.cwd();

      if (!cmdOptions.all && toolArgs.length === 0) {
        output.error(
          `Specify at least one tool or use --all. Valid tools: ${VALID_TOOL_IDS.join(", ")}`
        );
        process.exit(1);
      }

      if (cmdOptions.all && toolArgs.length > 0) {
        output.warn(`--all is set; ignoring specified tools: ${toolArgs.join(", ")}`);
      }
      const toolIds: ToolId[] = cmdOptions.all ? [...VALID_TOOL_IDS] : (toolArgs as ToolId[]);

      try {
        const deps = await createDeps(
          projectRoot,
          {
            verbose,
            repo: globalOptions.repo,
            token: globalOptions.token,
            framework: globalOptions.framework,
          },
          output
        );

        output.validateTools(toolIds, VALID_TOOL_IDS);

        const { path: frameworkPath, version } = await resolveFramework(
          deps.resolver,
          deps.logger,
          { framework: globalOptions.framework, release: globalOptions.release }
        );

        const manifest = await deps.manifestRepo.load();
        if (manifest === null) {
          throw new NoManifestError(globalOptions.repo);
        }

        const docsDir = manifest.docsDir;
        const installUseCase = new InstallUseCase(
          deps.fs,
          deps.manifestRepo,
          deps.loader,
          deps.hasher,
          deps.logger,
          deps.platform
        );

        const results = await installUseCase.execute({
          toolIds,
          frameworkPath,
          version,
          docsDir,
          projectRoot,
          force: cmdOptions.force,
          repo: globalOptions.repo,
        });

        const installed = results.filter((r) => !r.skipped);
        const skipped = results.filter((r) => r.skipped);

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
        output.exit(error);
      }
    });
}
