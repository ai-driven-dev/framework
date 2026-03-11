import type { Command } from "commander";
import { type ToolId, VALID_TOOL_IDS } from "../../domain/models/tool-config.js";
import {
  InquirerPrompterAdapter,
  SilentPrompterAdapter,
} from "../../infrastructure/adapters/prompter-adapter.js";
import { createDeps } from "../../infrastructure/deps.js";
import { CLIOutput } from "../output.js";
import { resolveFramework } from "../use-cases/resolve-framework-use-case.js";
import { UpdateUseCase } from "../use-cases/update-use-case.js";

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description("Update installed files to the latest framework version")
    .option("-f, --force", "Overwrite conflicting files without prompting", false)
    .option("--dry-run", "Preview changes without writing files", false)
    .option("--tool <tool>", "Limit update to a specific tool")
    .option("--docs", "Limit update to docs only")
    .action(async (cmdOptions: { force: boolean; dryRun: boolean; tool?: string; docs?: boolean }) => {
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

      if (cmdOptions.tool !== undefined && cmdOptions.docs) {
        output.error("--tool and --docs are mutually exclusive");
        process.exit(1);
      }
      if (cmdOptions.tool !== undefined) {
        output.validateTools([cmdOptions.tool], VALID_TOOL_IDS);
      }

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
          toolIds: cmdOptions.tool ? [cmdOptions.tool as ToolId] : undefined,
          docsOnly: cmdOptions.docs ?? false,
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
            const changed = tool.diff.filter((d) => d.kind !== "unchanged");
            if (changed.length === 0) continue;
            output.info(`\n${tool.toolId} (v${version}):`);
            for (const diff of changed) {
              const conflict = diff.conflict ? " [conflict]" : "";
              output.info(`  [${diff.kind}]${conflict} ${diff.relativePath}`);
            }
          }
          if (result.docs) {
            const changed = result.docs.diff.filter((d) => d.kind !== "unchanged");
            if (changed.length > 0) {
              output.info(`\ndocs (v${version}):`);
              for (const diff of changed) {
                const conflict = diff.conflict ? " [conflict]" : "";
                output.info(`  [${diff.kind}]${conflict} ${diff.relativePath}`);
              }
            }
          }
          return;
        }

        for (const tool of result.tools) {
          if (tool.alreadyUpToDate) continue;
          output.info(`\n${tool.toolId} (v${version}):`);
          for (const f of tool.written) output.info(`  + ${f}`);
          for (const f of tool.deleted) output.info(`  - ${f}`);
          for (const f of tool.kept) output.info(`  ~ kept: ${f}`);
          for (const f of tool.backedUp) output.info(`  ~ backup: ${f}`);
        }
        if (result.docs && !result.docs.alreadyUpToDate) {
          output.info(`\ndocs (v${version}):`);
          for (const f of result.docs.written) output.info(`  + ${f}`);
          for (const f of result.docs.deleted) output.info(`  - ${f}`);
          for (const f of result.docs.kept) output.info(`  ~ kept: ${f}`);
          for (const f of result.docs.backedUp) output.info(`  ~ backup: ${f}`);
        }

        const totalWritten =
          result.tools.reduce((sum, t) => sum + t.written.length, 0) +
          (result.docs?.written.length ?? 0);
        const totalDeleted =
          result.tools.reduce((sum, t) => sum + t.deleted.length, 0) +
          (result.docs?.deleted.length ?? 0);
        const toolCount = result.tools.filter((t) => !t.alreadyUpToDate).length;

        output.success(
          `\nUpdated ${totalWritten} files, deleted ${totalDeleted} files across ${toolCount} tool(s)`
        );
      } catch (error) {
        output.exit(error);
      }
    });
}
