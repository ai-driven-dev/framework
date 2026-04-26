import type { Command } from "commander";
import { assertValidToolIds, type ToolId } from "../../domain/tools/registry.js";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { SyncUseCase } from "../use-cases/sync/sync-use-case.js";
import { parseGlobalOptions } from "./global-options.js";

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
        const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
        const errorHandler = new ErrorHandler(output);

        if (!cmdOptions.source && !process.stdout.isTTY) {
          output.error(
            "--source <tool> is required. Usage: aidd sync --source <tool> [--target <tool>]"
          );
          process.exit(1);
        }

        try {
          if (cmdOptions.source !== undefined) {
            assertValidToolIds([cmdOptions.source]);
          }
          if (cmdOptions.target !== undefined) {
            assertValidToolIds([cmdOptions.target]);
          }

          const deps = await createDeps(projectRoot, { verbose, repo }, output);

          const sourceTool = cmdOptions.source as ToolId | undefined;
          const targetTools = cmdOptions.target ? [cmdOptions.target as ToolId] : undefined;

          const syncUseCase = new SyncUseCase(
            deps.fs,
            deps.manifestRepo,
            deps.hasher,
            deps.logger,
            deps.prompter
          );

          const result = await syncUseCase.execute({
            projectRoot,
            sourceTool,
            targetTools,
            force: cmdOptions.force,
            includeUserFiles: cmdOptions.includeUserFiles,
            repo: repo,
            interactive: process.stdout.isTTY,
          });

          const { totalWritten, totalDeleted, totalConflicts, totalSkipped } = result;

          if (totalWritten === 0 && totalDeleted === 0 && totalConflicts === 0) {
            output.success(
              totalSkipped > 0
                ? `Nothing to sync — ${totalSkipped} ${totalSkipped === 1 ? "file" : "files"} already identical.`
                : "Nothing to sync — source tool has no modified files."
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
            `Synced ${totalWritten} ${totalWritten === 1 ? "file" : "files"}, deleted ${totalDeleted} ${totalDeleted === 1 ? "file" : "files"} from ${result.sourceTool}`
          );
        } catch (error) {
          errorHandler.handle(error);
        }
      }
    );
}
