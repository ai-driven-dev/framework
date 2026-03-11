import type { Command } from "commander";
import { type ToolId, VALID_TOOL_IDS } from "../../domain/models/tool-config.js";
import {
  InquirerPrompterAdapter,
  SilentPrompterAdapter,
} from "../../infrastructure/adapters/prompter-adapter.js";
import { createDeps } from "../../infrastructure/deps.js";
import { CLIOutput } from "../output.js";
import { resolveFrameworkWithFallback } from "../use-cases/resolve-framework-use-case.js";
import { RestoreUseCase } from "../use-cases/restore-use-case.js";

export function registerRestoreCommand(program: Command): void {
  program
    .command("restore")
    .description("Restore files to their framework version")
    .argument("[files...]", "Specific file paths to restore (relative paths)")
    .option("-f, --force", "Restore without prompting", false)
    .option("--tool <tool>", "Limit restore to a specific tool")
    .option("--docs", "Limit restore to docs only")
    .action(async (fileArgs: string[], cmdOptions: { force: boolean; tool?: string; docs?: boolean }) => {
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

        const docsOnly = cmdOptions.docs ?? false;

        const pinnedVersion = cmdOptions.tool
          ? manifest.getToolVersion(cmdOptions.tool as ToolId)
          : manifest
              .getInstalledToolIds()
              .map((id) => manifest.getToolVersion(id))
              .find((v) => v !== undefined);

        const { path: frameworkPath, version } = await resolveFrameworkWithFallback(
          deps.resolver,
          deps.logger,
          { framework: globalOptions.framework, pinnedVersion, release: globalOptions.release }
        );

        const toolIds: ToolId[] | undefined = cmdOptions.tool
          ? [cmdOptions.tool as ToolId]
          : undefined;

        if (!cmdOptions.force && !process.stdout.isTTY) {
          output.error("Restore requires --force in non-interactive mode.");
          process.exit(1);
        }

        const prompter = cmdOptions.force
          ? new SilentPrompterAdapter()
          : new InquirerPrompterAdapter();

        const restoreUseCase = new RestoreUseCase(
          deps.fs,
          deps.manifestRepo,
          deps.loader,
          deps.hasher,
          deps.logger,
          prompter
        );

        const result = await restoreUseCase.execute({
          frameworkPath,
          version,
          docsDir: manifest.docsDir,
          projectRoot,
          toolIds,
          docsOnly,
          files: fileArgs.length > 0 ? fileArgs : undefined,
          force: cmdOptions.force,
          manifest,
        });

        const nothingDone =
          result.tools.every((t) => t.nothingToRestore) &&
          (result.docs === null || result.docs.nothingToRestore);

        if (nothingDone) {
          output.success("Nothing to restore — all files are unmodified.");
          return;
        }

        for (const tool of result.tools) {
          if (tool.nothingToRestore) continue;
          output.info(`\n${tool.toolId}:`);
          for (const f of tool.restored) output.info(`  + ${f}`);
          for (const f of tool.kept) output.info(`  ~ kept: ${f}`);
        }
        if (result.docs && !result.docs.nothingToRestore) {
          output.info("\ndocs:");
          for (const f of result.docs.restored) output.info(`  + ${f}`);
          for (const f of result.docs.kept) output.info(`  ~ kept: ${f}`);
        }

        const totalRestored =
          result.tools.reduce((sum, t) => sum + t.restored.length, 0) +
          (result.docs?.restored.length ?? 0);
        const totalKept =
          result.tools.reduce((sum, t) => sum + t.kept.length, 0) + (result.docs?.kept.length ?? 0);

        output.success(`\nRestored ${totalRestored} file(s), kept ${totalKept} file(s)`);
      } catch (error) {
        output.exit(error);
      }
    });
}
