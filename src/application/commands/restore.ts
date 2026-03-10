import type { Command } from "commander";
import { type ToolId, VALID_TOOL_IDS } from "../../domain/models/tool-config.js";
import {
  InquirerPrompterAdapter,
  SilentPrompterAdapter,
} from "../../infrastructure/adapters/prompter-adapter.js";
import { createDeps } from "../../infrastructure/deps.js";
import { printUpdateBanner } from "../check-update.js";
import { CLIOutput } from "../output.js";
import { resolveFrameworkWithFallback } from "../use-cases/resolve-framework-use-case.js";
import { RestoreUseCase } from "../use-cases/restore-use-case.js";

export function registerRestoreCommand(program: Command): void {
  program
    .command("restore")
    .description("Restore tool files to their framework version")
    .argument("[files...]", "Specific file paths to restore (relative paths)")
    .option("-f, --force", "Restore without prompting", false)
    .option("--tool <tool>", "Limit restore to a specific tool")
    .action(async (fileArgs: string[], cmdOptions: { force: boolean; tool?: string }) => {
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

        await printUpdateBanner(deps.resolver, deps.manifestRepo, output);

        const manifest = await deps.manifestRepo.load();
        if (manifest === null) {
          output.error("No AIDD installation found. Run `aidd init` first.");
          process.exit(1);
        }

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
          files: fileArgs.length > 0 ? fileArgs : undefined,
          force: cmdOptions.force,
          manifest,
        });

        const nothingDone = result.tools.every((t) => t.nothingToRestore);

        if (nothingDone) {
          output.success("Nothing to restore — all files are unmodified.");
          return;
        }

        const totalRestored = result.tools.reduce((sum, t) => sum + t.restored.length, 0);
        const totalKept = result.tools.reduce((sum, t) => sum + t.kept.length, 0);
        const totalRemoved = result.tools.reduce((sum, t) => sum + t.removed.length, 0);

        if (verbose) {
          for (const tool of result.tools) {
            if (tool.nothingToRestore) continue;
            output.debug(`Tool: ${tool.toolId}`);
            for (const f of tool.restored) output.debug(`  restored: ${f}`);
            for (const f of tool.kept) output.debug(`  kept: ${f}`);
            for (const f of tool.removed) output.debug(`  removed: ${f}`);
          }
        }

        output.success(
          `Restored ${totalRestored} file(s), kept ${totalKept} file(s), removed ${totalRemoved} untracked file(s)`
        );
      } catch (error) {
        output.exit(error);
      }
    });
}
