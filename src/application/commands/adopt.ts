import type { Command } from "commander";
import {
  assertValidToolIds,
  type ToolId,
  VALID_TOOL_IDS,
} from "../../domain/models/tool-config.js";
import { createDeps } from "../../infrastructure/deps.js";
import { AdoptRequiresVersionError } from "../errors.js";
import { CLIOutput } from "../output.js";
import { AdoptUseCase } from "../use-cases/adopt-use-case.js";
import { resolveFramework } from "../use-cases/resolve-framework-use-case.js";

export function registerAdoptCommand(program: Command): void {
  program
    .command("adopt")
    .description(
      "Bootstrap a manifest for projects with pre-existing AIDD files installed manually"
    )
    .option(
      "-t, --tools <tools>",
      "Comma-separated list of installed tools (claude, cursor, copilot)"
    )
    .option("-d, --docs-dir <dir>", "Documentation directory", "aidd_docs")
    .option(
      "--from <version|path>",
      "(required) Framework version (e.g. 3.6.0) or local path to adopt against"
    )
    .action(async (cmdOptions: { tools?: string; docsDir: string; from?: string }) => {
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
        const deps = await createDeps(
          projectRoot,
          { verbose, repo: globalOptions.repo, token: globalOptions.token },
          output
        );

        let toolIds: ToolId[];

        if (cmdOptions.tools) {
          toolIds = cmdOptions.tools.split(",").map((t) => t.trim()) as ToolId[];
          assertValidToolIds(toolIds);
        } else {
          if (!process.stdout.isTTY) {
            output.error("aidd adopt requires --tools in non-interactive mode.");
            process.exit(1);
          }

          const choices = VALID_TOOL_IDS.map((id) => ({ name: id, value: id, checked: false }));

          const selected = await deps.prompter.checkbox(
            "Which tools do you want to adopt?",
            choices
          );

          if (selected.length === 0) {
            output.error("No tools selected.");
            process.exit(1);
          }

          toolIds = selected as ToolId[];
        }

        let from = cmdOptions.from ?? globalOptions.release ?? globalOptions.framework;

        if (!from) {
          if (!process.stdout.isTTY) {
            throw new AdoptRequiresVersionError(globalOptions.repo);
          }

          const answer = await deps.prompter.input("Framework version tag or local path:", "");

          if (!answer) {
            throw new AdoptRequiresVersionError(globalOptions.repo);
          }

          from = answer;
        }

        const { path: frameworkPath, version } = await resolveFramework(
          deps.resolver,
          deps.logger,
          { from }
        );

        const result = await new AdoptUseCase(
          deps.fs,
          deps.manifestRepo,
          deps.loader,
          deps.hasher,
          deps.logger,
          deps.platform
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
