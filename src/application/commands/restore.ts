import type { Command } from "commander";
import { assertValidToolIds, type ToolId } from "../../domain/models/tool-config.js";

import { createDeps } from "../../infrastructure/deps.js";
import { NoManifestError } from "../errors.js";
import { CLIOutput } from "../output.js";
import { requireAuth } from "../require-auth.js";
import { resolveFrameworkWithFallback } from "../use-cases/resolve-framework-use-case.js";
import { RestoreUseCase } from "../use-cases/restore-use-case.js";
import { StatusUseCase } from "../use-cases/status-use-case.js";

export function registerRestoreCommand(program: Command): void {
  program
    .command("restore")
    .description("Restore files to their framework version")
    .argument("[files...]", "Specific file paths to restore (relative paths)")
    .option("-f, --force", "Restore without prompting", false)
    .option("--tool <tool>", "Limit restore to a specific tool")
    .option("--docs", "Limit restore to docs only")
    .option("--path <path>", "Path to a local framework directory or tarball")
    .option("--release <tag>", "Specific framework release tag to restore against (e.g., v3.2.0)")
    .action(
      async (
        fileArgs: string[],
        cmdOptions: {
          force: boolean;
          tool?: string;
          docs?: boolean;
          path?: string;
          release?: string;
        }
      ) => {
        const globalOptions = program.opts<{
          verbose: boolean;
          repo?: string;
        }>();

        const verbose = globalOptions.verbose ?? false;
        const output = new CLIOutput(verbose);
        const projectRoot = process.cwd();

        if (cmdOptions.tool !== undefined && cmdOptions.docs) {
          output.error("--tool and --docs are mutually exclusive");
          process.exit(1);
        }

        try {
          if (cmdOptions.tool !== undefined) {
            assertValidToolIds([cmdOptions.tool]);
          }

          const deps = await createDeps(
            projectRoot,
            {
              verbose,
              repo: globalOptions.repo,
            },
            output
          );

          const manifest = await deps.manifestRepo.load();
          if (manifest === null) {
            throw new NoManifestError(globalOptions.repo);
          }

          const docsOnly = cmdOptions.docs ?? false;

          const pinnedVersion = cmdOptions.tool
            ? manifest.getToolVersion(cmdOptions.tool as ToolId)
            : manifest
                .getInstalledToolIds()
                .map((id) => manifest.getToolVersion(id))
                .find((v) => v !== undefined);

          if (!cmdOptions.path) await requireAuth(deps.authReader);

          const { path: frameworkPath, version } = await resolveFrameworkWithFallback(
            deps.resolver,
            deps.logger,
            { path: cmdOptions.path, pinnedVersion, release: cmdOptions.release }
          );

          const toolIds: ToolId[] | undefined = cmdOptions.tool
            ? [cmdOptions.tool as ToolId]
            : undefined;

          let effectiveFiles: string[] | undefined = fileArgs.length > 0 ? fileArgs : undefined;

          const isTTY = process.stdout.isTTY;
          const isInteractive =
            fileArgs.length === 0 &&
            cmdOptions.tool === undefined &&
            !cmdOptions.docs &&
            !cmdOptions.force &&
            isTTY;

          if (isInteractive) {
            const statusUseCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger);
            const statusReport = await statusUseCase.execute({
              projectRoot,
              repo: globalOptions.repo,
            });

            const driftedFiles = [
              ...statusReport.tools.flatMap((t) =>
                t.drifted
                  .filter((d) => d.status === "modified" || d.status === "deleted")
                  .map((d) => d.relativePath)
              ),
              ...(statusReport.docs?.drifted
                .filter((d) => d.status === "modified" || d.status === "deleted")
                .map((d) => d.relativePath) ?? []),
            ];

            if (driftedFiles.length === 0) {
              output.info("Nothing to restore.");
              return;
            }

            const selected = await deps.prompter.checkbox(
              "Select files to restore:",
              driftedFiles.map((f) => ({ name: f, value: f }))
            );

            if (selected.length === 0) {
              output.info("No files selected.");
              return;
            }

            effectiveFiles = selected;
          }

          const prompter = deps.prompter;

          const restoreUseCase = new RestoreUseCase(
            deps.fs,
            deps.manifestRepo,
            deps.loader,
            deps.hasher,
            deps.logger,
            prompter,
            deps.platform
          );

          const result = await restoreUseCase.execute({
            frameworkPath,
            version,
            docsDir: manifest.docsDir,
            projectRoot,
            toolIds,
            docsOnly,
            files: effectiveFiles,
            force: isInteractive ? true : cmdOptions.force,
            interactive: isTTY,
            manifest,
            repo: globalOptions.repo,
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
            output.print("");
            output.print(`${tool.toolId}:`);
            for (const f of tool.restored) output.print(`  + ${f}`);
            for (const f of tool.kept) output.print(`  ~ kept: ${f}`);
          }
          if (result.docs && !result.docs.nothingToRestore) {
            output.print("");
            output.print("docs:");
            for (const f of result.docs.restored) output.print(`  + ${f}`);
            for (const f of result.docs.kept) output.print(`  ~ kept: ${f}`);
          }

          const restored = result.totalRestored;
          const kept = result.totalKept;
          output.print("");
          output.success(
            `Restored ${restored} ${restored === 1 ? "file" : "files"}, kept ${kept} ${kept === 1 ? "file" : "files"}`
          );
        } catch (error) {
          output.exit(error);
        }
      }
    );
}
