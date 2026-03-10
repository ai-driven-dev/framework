import type { Command } from "commander";
import {
  InquirerPrompterAdapter,
  SilentPrompterAdapter,
} from "../../infrastructure/adapters/prompter-adapter.js";
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
    .option("-f, --force", "Overwrite conflicting files without prompting", false)
    .action(async (cmdOptions: { force: boolean }) => {
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

        const { path: frameworkPath, version } = await resolveFramework(
          deps.resolver,
          deps.logger,
          { framework: globalOptions.framework, release: globalOptions.release }
        );

        const docsDir = "aidd_docs";

        const prompter = cmdOptions.force
          ? new SilentPrompterAdapter()
          : new InquirerPrompterAdapter();

        const adoptUseCase = new AdoptUseCase(
          deps.fs,
          deps.manifestRepo,
          deps.loader,
          deps.hasher,
          deps.logger,
          prompter
        );

        const result = await adoptUseCase.execute({
          frameworkPath,
          version,
          docsDir,
          projectRoot,
          force: cmdOptions.force,
        });

        if (verbose) {
          for (const tool of result.tools) {
            output.debug(`Tool: ${tool.toolId}`);
            for (const f of tool.written) output.debug(`  + ${f}`);
            for (const f of tool.kept) output.debug(`  ~ kept: ${f}`);
            for (const f of tool.backedUp) output.debug(`  ~ backup: ${f}`);
            for (const f of tool.orphans) output.debug(`  ! orphan: ${f}`);
          }
        }

        output.success(
          `Adopted ${result.tools.length} tool(s): ${result.totalWritten} written, ${result.totalKept} kept, ${result.totalBackedUp} backed up`
        );

        if (result.orphans.length > 0) {
          output.warn(
            `${result.orphans.length} orphan file(s) found on disk (not in framework distribution — review manually)`
          );
        }
      } catch (error) {
        output.exit(error);
      }
    });
}
