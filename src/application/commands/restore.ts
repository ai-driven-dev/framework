import type { Command } from "commander";
import { assertValidToolIds, type ToolId } from "../../domain/tools/registry.js";

import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { NoManifestError } from "../errors.js";
import { ResolveFrameworkUseCase } from "../use-cases/resolve-framework-use-case.js";
import { RestorePluginUseCase } from "../use-cases/restore/restore-plugin-use-case.js";
import { RestoreUseCase } from "../use-cases/restore/restore-use-case.js";
import { StatusUseCase } from "../use-cases/status-use-case.js";
import { parseGlobalOptions } from "./global-options.js";

export function registerRestoreCommand(program: Command): void {
  program
    .command("restore")
    .description("Restore files to their framework version")
    .argument("[files...]", "Specific file paths to restore (relative paths)")
    .option("-f, --force", "Restore without prompting", false)
    .option("--tool <tool>", "Limit restore to a specific tool")
    .option("--path <path>", "Path to a local framework directory or tarball")
    .option("--release <tag>", "Specific framework release tag to restore against (e.g., v3.2.0)")
    .option("--plugin <name>", "Restore a specific plugin by name")
    .action(
      async (
        fileArgs: string[],
        cmdOptions: {
          force: boolean;
          tool?: string;
          path?: string;
          release?: string;
          plugin?: string;
        }
      ) => {
        const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
        const errorHandler = new ErrorHandler(output);

        try {
          if (cmdOptions.tool !== undefined) {
            assertValidToolIds([cmdOptions.tool]);
          }

          const deps = await createDeps(projectRoot, { verbose, repo }, output);

          if (cmdOptions.plugin !== undefined) {
            await new RestorePluginUseCase(
              deps.fs,
              deps.manifestRepo,
              deps.pluginFetcher,
              deps.pluginDistributionReader,
              deps.hasher
            ).execute({ pluginName: cmdOptions.plugin, projectRoot, repo });
            output.success(`Plugin ${cmdOptions.plugin} restored.`);
            return;
          }

          const manifest = await deps.manifestRepo.load();
          if (manifest === null) {
            throw new NoManifestError(repo);
          }

          const pinnedVersion = cmdOptions.tool
            ? manifest.getToolVersion(cmdOptions.tool as ToolId)
            : manifest
                .getInstalledToolIds()
                .map((id) => manifest.getToolVersion(id))
                .find((v) => v !== undefined);

          const { path: frameworkPath, version } = await new ResolveFrameworkUseCase(
            deps.resolver,
            deps.logger,
            deps.authReader
          ).execute({ path: cmdOptions.path, pinnedVersion, release: cmdOptions.release });

          const toolIds: ToolId[] | undefined = cmdOptions.tool
            ? [cmdOptions.tool as ToolId]
            : undefined;

          let effectiveFiles: string[] | undefined = fileArgs.length > 0 ? fileArgs : undefined;

          const isTTY = process.stdout.isTTY;
          const isInteractive =
            fileArgs.length === 0 && cmdOptions.tool === undefined && !cmdOptions.force && isTTY;

          if (isInteractive) {
            const statusUseCase = new StatusUseCase(
              deps.fs,
              deps.manifestRepo,
              deps.logger,
              deps.hasher
            );
            const statusReport = await statusUseCase.execute({
              projectRoot,
              repo: repo,
            });

            const driftedFiles = statusReport.tools.flatMap((t) =>
              t.drifted
                .filter((d) => d.status === "modified" || d.status === "deleted")
                .map((d) => d.relativePath)
            );

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
            deps.platform,
            prompter,
            deps.pluginFetcher,
            deps.pluginDistributionReader
          );

          const result = await restoreUseCase.execute({
            frameworkPath,
            version,
            docsDir: manifest.docsDir,
            projectRoot,
            toolIds,
            files: effectiveFiles,
            force: isInteractive ? true : cmdOptions.force,
            interactive: isTTY,
            manifest,
            repo: repo,
          });

          const nothingDone =
            result.tools.every((t) => t.nothingToRestore) && result.totalPluginFilesRestored === 0;

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

          const restored = result.totalRestored;
          const kept = result.totalKept;
          const pluginFiles = result.totalPluginFilesRestored;
          output.print("");
          const pluginSuffix =
            pluginFiles > 0
              ? `, ${pluginFiles} plugin ${pluginFiles === 1 ? "file" : "files"}`
              : "";
          output.success(
            `Restored ${restored} ${restored === 1 ? "file" : "files"}, kept ${kept} ${kept === 1 ? "file" : "files"}${pluginSuffix}`
          );
        } catch (error) {
          errorHandler.handle(error);
        }
      }
    );
}
