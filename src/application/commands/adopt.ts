import type { Command } from "commander";
import type { ToolId } from "../../domain/models/tool-config.js";
import { createDeps } from "../../infrastructure/deps.js";
import { CLIOutput } from "../output.js";
import { AdoptUseCase } from "../use-cases/adopt-use-case.js";
import { resolveFramework } from "../use-cases/resolve-framework-use-case.js";

export function registerAdoptCommand(program: Command): void {
  program
    .command("adopt")
    .description(
      "Bootstrap a manifest for projects with pre-existing AIDD files installed manually"
    )
    .requiredOption(
      "-t, --tools <tools>",
      "Comma-separated list of installed tools (claude, cursor, copilot)"
    )
    .option("-d, --docs-dir <dir>", "Documentation directory", "aidd_docs")
    .action(async (cmdOptions: { tools: string; docsDir: string }) => {
      const globalOptions = program.opts<{
        verbose: boolean;
        repo?: string;
        token?: string;
        framework?: string;
        release?: string;
      }>();
      const verbose = globalOptions.verbose;
      const output = new CLIOutput(verbose);
      const projectRoot = process.cwd();

      try {
        if (!globalOptions.release && !globalOptions.framework) {
          throw new Error(
            "--release <version> or --framework <path> is required for adopt. Example: aidd --release 3.3.3 adopt --tools claude"
          );
        }

        const toolIds = cmdOptions.tools.split(",").map((t) => t.trim()) as ToolId[];
        const deps = await createDeps(
          projectRoot,
          { verbose, repo: globalOptions.repo, token: globalOptions.token },
          output
        );

        const { path: frameworkPath, version } = await resolveFramework(
          deps.resolver,
          deps.logger,
          { framework: globalOptions.framework, release: globalOptions.release }
        );

        const result = await new AdoptUseCase(
          deps.fs,
          deps.manifestRepo,
          deps.loader,
          deps.hasher,
          deps.logger
        ).execute({
          toolIds,
          frameworkPath,
          docsDir: cmdOptions.docsDir,
          projectRoot,
          version,
        });

        if (verbose) {
          for (const tool of result.tools) {
            output.debug(`Tool: ${tool.toolId}`);
            for (const f of tool.registered) output.debug(`  ~ registered: ${f}`);
          }
        }

        output.success(
          `Adopted ${result.tools.length} tool(s) at version ${version}: ${result.totalRegistered} files registered, ${result.docsRegistered} docs registered`
        );
      } catch (error) {
        output.exit(error);
      }
    });
}
