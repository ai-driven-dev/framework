import type { Command } from "commander";
import { createDeps } from "../../infrastructure/deps.js";
import { CLIOutput } from "../output.js";
import { InitUseCase } from "../use-cases/init-use-case.js";
import { resolveFramework } from "../use-cases/resolve-framework-use-case.js";

const VALID_DOCS_DIR = /^[a-zA-Z0-9_-]+$/;
const DEFAULT_DOCS_DIR = "aidd_docs";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize the shared documentation structure")
    .option("--docs-dir <name>", "Custom documentation directory name")
    .option("--force", "Re-copy docs templates into existing docs directory", false)
    .action(async (cmdOptions: { docsDir?: string; force: boolean }) => {
      const globalOptions = program.opts<{
        verbose: boolean;
        repo?: string;
        token?: string;
        framework?: string;
        release?: string;
      }>();

      const explicitDocsDir = cmdOptions.docsDir;
      const docsDir = explicitDocsDir ?? DEFAULT_DOCS_DIR;
      const verbose = globalOptions.verbose ?? false;
      const output = new CLIOutput(verbose);

      if (!VALID_DOCS_DIR.test(docsDir) || docsDir.includes("..")) {
        output.error(
          `Invalid directory name: "${docsDir}". Use alphanumeric characters, hyphens, and underscores only.`
        );
        process.exit(1);
      }

      const projectRoot = process.cwd();

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
          repo: globalOptions.repo,
        });
        const { path: frameworkPath, version } = await resolveFramework(
          deps.resolver,
          deps.logger,
          { framework: globalOptions.framework, release: globalOptions.release }
        );
        const result = await useCase.execute({
          frameworkPath,
          version,
          docsDir,
          explicitDocsDir,
          projectRoot,
          force: cmdOptions.force,
          repo: globalOptions.repo,
        });
        output.success(`Initialized docs in ${result.docsDir}/ (${result.fileCount} files)`);
      } catch (error) {
        output.exit(error);
      }
    });
}
