import type { Command } from "commander";
import { assertValidToolIds, type ToolId } from "../../domain/models/tool-config.js";
import { createDeps } from "../../infrastructure/deps.js";
import { NoManifestError } from "../errors.js";
import { CLIOutput } from "../output.js";
import { SyncStatusUseCase } from "../use-cases/sync-status-use-case.js";
import { SyncUseCase } from "../use-cases/sync-use-case.js";

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description("Propagate local modifications from one tool to others")
    .option("--source <tool>", "Source tool to sync from")
    .option("--target <tool>", "Target tool to sync to (default: all other installed tools)")
    .option("-f, --force", "Overwrite conflicting files without prompting", false)
    .option("--include-user-files", "Also sync user-created files not tracked in manifest", false)
    .action(
      async (cmdOptions: {
        source?: string;
        target?: string;
        force: boolean;
        includeUserFiles: boolean;
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

          const manifest = await deps.manifestRepo.load();
          if (manifest === null) {
            throw new NoManifestError(globalOptions.repo);
          }

          let sourceTool: ToolId;
          let targetTools: ToolId[] | undefined;

          if (cmdOptions.source === undefined) {
            if (!process.stdout.isTTY) {
              output.error("--source is required in non-interactive mode.");
              process.exit(1);
            }

            const installedIds = manifest.getInstalledToolIds();
            if (installedIds.length < 2) {
              output.error("At least 2 tools must be installed to use sync.");
              process.exit(1);
            }

            const modCounts = await new SyncStatusUseCase(deps.fs).execute(
              manifest,
              installedIds as ToolId[],
              projectRoot
            );

            const sourceChoices = installedIds.map((id) => {
              const { modified, deleted } = modCounts[id] ?? { modified: 0, deleted: 0 };
              const hasChanges = modified > 0 || deleted > 0;
              const parts: string[] = [];
              if (modified > 0) parts.push(`${modified} modified`);
              if (deleted > 0) parts.push(`${deleted} deleted`);
              const label = hasChanges ? ` (${parts.join(", ")})` : "";
              return {
                name: `${id}${label}`,
                value: id as ToolId,
                disabled: hasChanges ? false : "(no changes)",
              };
            });

            sourceTool = await deps.prompter.select("Source tool to sync from?", sourceChoices);

            const targetChoices = installedIds
              .filter((id) => id !== sourceTool)
              .map((id) => ({ name: id, value: id as ToolId }));

            targetTools = await deps.prompter.checkbox("Target tools?", targetChoices);

            if (targetTools.length === 0) {
              output.error("No target tools selected.");
              process.exit(1);
            }
          } else {
            assertValidToolIds([cmdOptions.source]);
            if (cmdOptions.target) {
              assertValidToolIds([cmdOptions.target]);
            }
            sourceTool = cmdOptions.source as ToolId;
            targetTools = cmdOptions.target ? [cmdOptions.target as ToolId] : undefined;
          }

          const docsDir = manifest.docsDir;

          const syncUseCase = new SyncUseCase(deps.fs, deps.manifestRepo, deps.hasher, deps.logger);

          const result = await syncUseCase.execute({
            projectRoot,
            docsDir,
            sourceTool,
            targetTools,
            force: cmdOptions.force,
            includeUserFiles: cmdOptions.includeUserFiles,
            repo: globalOptions.repo,
          });

          const totalWritten = result.tools.reduce(
            (sum, t) => sum + t.files.filter((f) => f.written).length,
            0
          );
          const totalDeleted = result.tools.reduce(
            (sum, t) => sum + t.files.filter((f) => f.deleted).length,
            0
          );
          const totalConflicts = result.tools.reduce(
            (sum, t) => sum + t.files.filter((f) => f.conflict && !f.written).length,
            0
          );
          const totalSkipped = result.tools.reduce(
            (sum, t) => sum + t.files.filter((f) => f.skipped).length,
            0
          );

          if (totalWritten === 0 && totalDeleted === 0 && totalConflicts === 0) {
            output.success(
              totalSkipped > 0
                ? `Nothing to sync — ${totalSkipped} file(s) already identical.`
                : "Nothing to sync — no modified files found in source tool."
            );
            return;
          }

          if (verbose) {
            for (const tool of result.tools) {
              output.debug(`Target: ${tool.targetToolId}`);
              for (const f of tool.files) {
                if (f.written) output.debug(`  synced: ${f.relativePath}`);
                else if (f.deleted) output.debug(`  deleted: ${f.relativePath}`);
                else if (f.conflict) output.debug(`  conflict (skipped): ${f.relativePath}`);
                else if (f.skipped) output.debug(`  identical (skipped): ${f.relativePath}`);
              }
            }
          }

          if (totalConflicts > 0) {
            output.warn(`${totalConflicts} conflict(s) skipped. Use --force to overwrite.`);
          }

          output.success(
            `Synced ${totalWritten} file(s), deleted ${totalDeleted} file(s) from ${sourceTool}`
          );
        } catch (error) {
          output.exit(error);
        }
      }
    );
}
