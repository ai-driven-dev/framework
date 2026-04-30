import type { Command } from "commander";
import {
  assertToolIdsMatchCategory,
  type ToolId,
  VALID_TOOL_IDS,
} from "../../domain/tools/registry.js";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import type { CLIOutput } from "../output.js";
import type { InstallToolResult } from "../use-cases/install/install-use-case.js";
import { SetupUseCase } from "../use-cases/setup-use-case.js";
import { parseGlobalOptions } from "./global-options.js";

function resolveToolIds(
  cmdOptions: { all?: boolean; ai?: string; ide?: string },
  errorHandler: ErrorHandler
): ToolId[] | undefined | null {
  if (cmdOptions.all) return [...VALID_TOOL_IDS];
  const aiIds =
    cmdOptions.ai
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const ideIds =
    cmdOptions.ide
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  try {
    if (aiIds.length > 0) assertToolIdsMatchCategory(aiIds as ToolId[], "ai");
    if (ideIds.length > 0) assertToolIdsMatchCategory(ideIds as ToolId[], "ide");
  } catch (e) {
    errorHandler.handle(e);
    return null;
  }
  if (aiIds.length === 0 && ideIds.length === 0) return undefined;
  return [...aiIds, ...ideIds] as ToolId[];
}

function displayInstall(output: CLIOutput, results: InstallToolResult[], verbose: boolean): void {
  const skipped = results.filter((r) => r.skipped);
  const installed = results.filter((r) => !r.skipped);
  for (const r of skipped) output.warn(`${r.toolId} is already installed.`);
  for (const r of installed) for (const w of r.warnings) output.warn(w);
  if (verbose) {
    for (const r of installed) {
      output.debug(`Tool: ${r.toolId}`);
      for (const f of r.files) output.debug(`  + ${f.relativePath}`);
    }
  }
  if (installed.length === 1) {
    output.success(`Installed ${installed[0].toolId} (${installed[0].fileCount} files)`);
  } else if (installed.length > 1) {
    const total = installed.reduce((s, r) => s + r.fileCount, 0);
    output.success(`Installed ${installed.map((r) => r.toolId).join(", ")} (${total} files)`);
  }
}

export function registerSetupCommand(program: Command): void {
  program
    .command("setup")
    .description("Set up or update the project to a correct state")
    .option("--path <path>", "Path to a local framework directory or tarball")
    .option("--release <tag>", "Specific framework release tag to install (e.g., v3.2.0)")
    .option("--docs-dir <dir>", "Documentation directory name (default: aidd_docs)")
    .option("--ai <ids>", "Comma-separated AI tool IDs to install (e.g., claude,cursor)")
    .option("--ide <ids>", "Comma-separated IDE tool IDs to install (e.g., vscode)")
    .option("--all", "Install all available tools (AI + IDE)")
    .option(
      "--from <version>",
      "Framework version already installed, required for adopt (e.g., v3.2.0)"
    )
    .option("--mode <mode>", "Distribution mode: local (default) or remote")
    .option("--switch-mode", "Switch distribution mode on existing project")
    .action(
      async (cmdOptions: {
        path?: string;
        release?: string;
        docsDir?: string;
        ai?: string;
        ide?: string;
        all?: boolean;
        from?: string;
        mode?: string;
        switchMode?: boolean;
      }) => {
        const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
        const errorHandler = new ErrorHandler(output);

        const rawToolIds = resolveToolIds(cmdOptions, errorHandler);
        if (rawToolIds === null) return;

        if (
          cmdOptions.mode !== undefined &&
          cmdOptions.mode !== "local" &&
          cmdOptions.mode !== "remote"
        ) {
          output.error(`Invalid --mode value: "${cmdOptions.mode}". Must be "local" or "remote".`);
          process.exit(1);
        }

        try {
          const hasScriptingFlags = !!(cmdOptions.all || cmdOptions.ai || cmdOptions.ide);
          const interactive = process.stdout.isTTY && !hasScriptingFlags;

          const deps = await createDeps(projectRoot, { verbose, repo }, output);

          const result = await new SetupUseCase(
            deps.fs,
            deps.manifestRepo,
            deps.loader,
            deps.hasher,
            deps.logger,
            deps.platform,
            deps.prompter,
            deps.resolver,
            deps.installFrameworkPluginsUseCase,
            deps.authReader
          ).execute({
            projectRoot,
            path: cmdOptions.path,
            release: cmdOptions.release,
            repo,
            interactive,
            docsDir: cmdOptions.docsDir,
            toolIds: rawToolIds,
            from: cmdOptions.from,
            mode: cmdOptions.mode as "local" | "remote" | undefined,
            switchMode: cmdOptions.switchMode,
          });

          const registrationResult = await deps.marketplaceRegisterFrameworkUseCase.execute({
            projectRoot,
            force: result.kind === "mode-switched",
          });

          await deps.marketplaceRefreshUseCase.execute({ projectRoot });
          await deps.marketplaceSyncSettingsUseCase.execute({ projectRoot });

          switch (result.kind) {
            case "initialized": {
              output.success(`Initialized docs in ${result.docsDir}/ (${result.fileCount} files)`);
              displayInstall(output, result.install.results, verbose);
              break;
            }

            case "adopted": {
              output.success(
                `Adopted ${result.toolCount} tool(s) at version ${result.version}: ${result.totalRegistered} files registered, ${result.docsRegistered} docs registered`
              );
              break;
            }

            case "installed": {
              displayInstall(output, result.install.results, verbose);
              break;
            }

            case "update-cancelled": {
              output.info("Update cancelled.");
              break;
            }

            case "updated": {
              let msg = `Updated ${result.totalWritten} files, deleted ${result.totalDeleted} files across ${result.toolCount} tool(s)`;
              if (result.pluginsUpdated > 0 || result.pluginsDeleted > 0) {
                msg += ` (plugins: ${result.pluginsUpdated} updated, ${result.pluginsDeleted} deleted)`;
              }
              output.success(msg);
              if (result.additionalInstall) {
                displayInstall(output, result.additionalInstall.results, verbose);
              }
              break;
            }

            case "up-to-date": {
              if (result.hasAdditionalTools) {
                output.info("All installed tools are up to date.");
              } else {
                output.info("Project is up to date.");
              }
              if (result.additionalInstall) {
                displayInstall(output, result.additionalInstall.results, verbose);
              }
              break;
            }

            case "mode-switched": {
              output.success(`Switched to ${result.newMode} mode.`);
              break;
            }
          }

          if (!interactive && registrationResult.registered) {
            output.info("Plugin marketplace ready. Run `aidd plugin pick` to install plugins.");
          }

          if (interactive) {
            const marketplaces = await deps.marketplaceRegistry.list(projectRoot);
            if (marketplaces.length > 0) {
              const proceed = await deps.prompter.confirm("Install plugins now?");
              if (proceed) {
                await deps.pluginPickUseCase.execute({
                  toolIds: "all",
                  projectRoot,
                  interactive: true,
                });
                await deps.marketplaceSyncSettingsUseCase.execute({ projectRoot });
              }
            }
          }
        } catch (error) {
          errorHandler.handle(error);
        }
      }
    );
}
