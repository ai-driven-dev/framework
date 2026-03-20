import type { Command } from "commander";
import { Manifest } from "../../domain/models/manifest.js";
import { createDeps } from "../../infrastructure/deps.js";
import { CLIOutput } from "../output.js";
import { InitUseCase } from "../use-cases/init-use-case.js";
import { resolveFramework } from "../use-cases/resolve-framework-use-case.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize the shared documentation structure")
    .option("--docs-dir <name>", "Custom documentation directory name")
    .option("--force", "Re-copy docs templates into existing docs directory", false)
    .option("--framework <path>", "Path to a local framework directory or tarball")
    .option("--release <tag>", "Specific framework release tag to install (e.g., v3.2.0)")
    .action(
      async (cmdOptions: {
        docsDir?: string;
        force: boolean;
        framework?: string;
        release?: string;
      }) => {
        const globalOptions = program.opts<{
          verbose: boolean;
          repo?: string;
          token?: string;
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
              token: globalOptions.token,
            },
            output
          );

          let explicitDocsDir = cmdOptions.docsDir;
          let interactiveRepo: string | undefined = globalOptions.repo;

          if (explicitDocsDir === undefined && !cmdOptions.force && process.stdout.isTTY) {
            const docsDirInput = await deps.prompter.input(
              "Documentation directory name:",
              Manifest.DEFAULT_DOCS_DIR
            );
            explicitDocsDir = docsDirInput;
            const repoInput = await deps.prompter.input(
              "Framework repository (owner/repo, leave blank to skip):",
              ""
            );
            if (repoInput !== "") {
              interactiveRepo = repoInput;
            }
          }

          const docsDir = explicitDocsDir ?? Manifest.DEFAULT_DOCS_DIR;
          Manifest.validateDocsDir(docsDir);

          const useCase = new InitUseCase(
            deps.fs,
            deps.manifestRepo,
            deps.loader,
            deps.hasher,
            deps.logger
          );
          await useCase.checkPreconditions({
            docsDir,
            projectRoot,
            force: cmdOptions.force,
            repo: interactiveRepo,
          });
          const { path: frameworkPath, version } = await resolveFramework(
            deps.resolver,
            deps.logger,
            { framework: cmdOptions.framework, release: cmdOptions.release }
          );
          const result = await useCase.execute({
            frameworkPath,
            version,
            docsDir,
            explicitDocsDir,
            projectRoot,
            force: cmdOptions.force,
            repo: interactiveRepo,
          });
          output.success(`Initialized docs in ${result.docsDir}/ (${result.fileCount} files)`);
        } catch (error) {
          output.exit(error);
        }
      }
    );
}
