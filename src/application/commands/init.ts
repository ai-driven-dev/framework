import type { Command } from "commander";
import { createDeps } from "../../infrastructure/deps.js";
import { CLIOutput } from "../output.js";
import { requireAuth } from "../require-auth.js";
import { InitUseCase } from "../use-cases/init-use-case.js";
import { resolveFramework } from "../use-cases/resolve-framework-use-case.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize the shared documentation structure")
    .option("--docs-dir <name>", "Custom documentation directory name")
    .option("--force", "Re-copy docs templates into existing docs directory", false)
    .option("--path <path>", "Path to a local framework directory or tarball")
    .option("--release <tag>", "Specific framework release tag to install (e.g., v3.2.0)")
    .action(
      async (cmdOptions: { docsDir?: string; force: boolean; path?: string; release?: string }) => {
        const globalOptions = program.opts<{
          verbose: boolean;
          repo?: string;
        }>();

        const verbose = globalOptions.verbose ?? false;
        const output = new CLIOutput(verbose);
        const projectRoot = process.cwd();

        try {
          const deps = await createDeps(
            projectRoot,
            {
              verbose,
              repo: globalOptions.repo,
            },
            output
          );

          if (!cmdOptions.path) await requireAuth(deps.authReader);

          const { path: frameworkPath, version } = await resolveFramework(
            deps.resolver,
            deps.logger,
            { path: cmdOptions.path, release: cmdOptions.release, repo: globalOptions.repo }
          );

          const useCase = new InitUseCase(
            deps.fs,
            deps.manifestRepo,
            deps.loader,
            deps.hasher,
            deps.logger,
            deps.prompter
          );

          const result = await useCase.execute({
            frameworkPath,
            version,
            docsDir: cmdOptions.docsDir,
            explicitDocsDir: cmdOptions.docsDir,
            projectRoot,
            force: cmdOptions.force,
            repo: globalOptions.repo,
            interactive: process.stdout.isTTY,
          });
          output.success(`Initialized docs in ${result.docsDir}/ (${result.fileCount} files)`);
        } catch (error) {
          output.exit(error);
        }
      }
    );
}
