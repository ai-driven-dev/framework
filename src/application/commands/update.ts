import type { Command } from "commander";
import {
  InquirerPrompterAdapter,
  SilentPrompterAdapter,
} from "../../infrastructure/adapters/prompter-adapter.js";
import { createDeps } from "../../infrastructure/deps.js";
import { printUpdateBanner } from "../check-update.js";
import { CLIOutput } from "../output.js";
import { resolveFramework } from "../use-cases/resolve-framework-use-case.js";
import { UpdateUseCase } from "../use-cases/update-use-case.js";

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description("Update installed tools to the latest framework version")
    .option("-f, --force", "Overwrite conflicting files without prompting", false)
    .option("--dry-run", "Preview changes without writing files", false)
    .action(async (cmdOptions: { force: boolean; dryRun: boolean }) => {
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

        await printUpdateBanner(deps.resolver, deps.manifestRepo, output);

        const manifest = await deps.manifestRepo.load();
        if (manifest === null) {
          output.error("No AIDD installation found. Run `aidd init` first.");
          process.exit(1);
        }

        const { path: frameworkPath, version } = await resolveFramework(
          deps.resolver,
          deps.logger,
          { framework: globalOptions.framework, release: globalOptions.release }
        );

        const prompter = cmdOptions.force
          ? new SilentPrompterAdapter()
          : new InquirerPrompterAdapter();

        const updateUseCase = new UpdateUseCase(
          deps.fs,
          deps.manifestRepo,
          deps.loader,
          deps.hasher,
          deps.logger,
          prompter
        );

        const result = await updateUseCase.execute({
          frameworkPath,
          version,
          docsDir: manifest.docsDir,
          projectRoot,
          force: cmdOptions.force,
          dryRun: cmdOptions.dryRun,
        });

        if (result.alreadyUpToDate) {
          output.success(`Already up to date (v${version})`);
          return;
        }

        if (result.dryRun) {
          output.info("Dry run — no files written.");
          for (const tool of result.tools) {
            for (const diff of tool.diff) {
              if (diff.kind !== "unchanged") {
                const conflict = diff.conflict ? " [conflict]" : "";
                output.info(`  [${diff.kind}]${conflict} ${diff.relativePath}`);
              }
            }
          }
          return;
        }

        const totalWritten = result.tools.reduce((sum, t) => sum + t.written.length, 0);
        const totalDeleted = result.tools.reduce((sum, t) => sum + t.deleted.length, 0);
        const toolCount = result.tools.filter((t) => !t.alreadyUpToDate).length;

        if (verbose) {
          for (const tool of result.tools) {
            if (tool.alreadyUpToDate) continue;
            output.debug(`Tool: ${tool.toolId}`);
            for (const f of tool.written) output.debug(`  + ${f}`);
            for (const f of tool.deleted) output.debug(`  - ${f}`);
            for (const f of tool.kept) output.debug(`  ~ kept: ${f}`);
            for (const f of tool.backedUp) output.debug(`  ~ backup: ${f}`);
          }
        }

        output.success(
          `Updated ${totalWritten} files, deleted ${totalDeleted} files across ${toolCount} tool(s)`
        );
      } catch (error) {
        output.exit(error);
      }
    });
}
