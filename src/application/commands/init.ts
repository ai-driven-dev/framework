import type { Command } from "commander";
import { createDeps } from "../../infrastructure/deps.js";
import { printError, printSuccess } from "../output.js";
import { GitignoreUseCase } from "../use-cases/gitignore-use-case.js";
import { InitUseCase } from "../use-cases/init-use-case.js";
import { resolveFramework } from "../use-cases/resolve-framework-use-case.js";

const VALID_DOCS_DIR = /^[a-zA-Z0-9_-]+$/;
const DEFAULT_DOCS_DIR = "aidd_docs";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize the shared documentation structure")
    .option("--docs-dir <name>", "Custom documentation directory name", DEFAULT_DOCS_DIR)
    .action(async (cmdOptions: { docsDir: string }) => {
      const globalOptions = program.opts<{
        verbose: boolean;
        repo?: string;
        token?: string;
        framework?: string;
      }>();

      const docsDir = cmdOptions.docsDir;

      if (!VALID_DOCS_DIR.test(docsDir) || docsDir.includes("..")) {
        printError(
          `Invalid directory name: "${docsDir}". Use alphanumeric characters, hyphens, and underscores only.`
        );
        process.exit(1);
      }

      const projectRoot = process.cwd();
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
        const useCase = new InitUseCase(deps.fs, deps.manifestRepo, deps.loader, deps.hasher);
        const result = await useCase.execute({ frameworkPath, version, docsDir, projectRoot });
        await new GitignoreUseCase(deps.fs).execute(projectRoot, [".aidd/cache/"]);
        printSuccess(`Initialized docs in ${result.docsDir}/ (${result.fileCount} files)`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        printError(msg);
        process.exit(1);
      }
    });
}
