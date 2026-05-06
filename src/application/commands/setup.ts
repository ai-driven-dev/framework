import type { Command } from "commander";
import {
  assertToolIdsMatchCategory,
  type ToolId,
  VALID_TOOL_IDS,
} from "../../domain/tools/registry.js";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import type { CLIOutput } from "../output.js";
import { SetupUseCase, type ToolInstallResult } from "../use-cases/setup-use-case.js";
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

function displayInstall(output: CLIOutput, results: ToolInstallResult[], verbose: boolean): void {
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
    .option("--ai <ids>", "Comma-separated AI tool IDs to install (e.g., claude,cursor)")
    .option("--ide <ids>", "Comma-separated IDE tool IDs to install (e.g., vscode)")
    .option("--all", "Install all available tools (AI + IDE)")
    .action(async (cmdOptions: { ai?: string; ide?: string; all?: boolean }) => {
      const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      const rawToolIds = resolveToolIds(cmdOptions, errorHandler);
      if (rawToolIds === null) return;

      try {
        const hasScriptingFlags = !!(cmdOptions.all || cmdOptions.ai || cmdOptions.ide);
        const interactive = process.stdout.isTTY && !hasScriptingFlags;

        const deps = await createDeps(projectRoot, { verbose, repo }, output);

        const result = await new SetupUseCase(
          deps.fs,
          deps.manifestRepo,
          deps.logger,
          deps.prompter,
          deps.installRuntimeConfigUseCase,
          deps.installIdeConfigUseCase,
          deps.installFrameworkPluginsUseCase,
          deps.currentVersionProvider,
          deps.marketplaceRegistry,
          deps.pluginCatalogRepository,
          deps.resolver
        ).execute({
          projectRoot,
          repo,
          interactive,
          toolIds: rawToolIds,
        });

        const resolvedRef =
          result.kind === "initialized" || result.kind === "installed"
            ? result.resolvedRef
            : undefined;
        const registrationResult = await deps.marketplaceRegisterFrameworkUseCase.execute({
          projectRoot,
          force: result.kind === "mode-switched",
          ref: resolvedRef,
        });

        if (process.env.AIDD_SKIP_MARKETPLACE_REFRESH !== "1") {
          await deps.marketplaceRefreshUseCase.execute({ projectRoot });
          await deps.marketplaceSyncSettingsUseCase.execute({ projectRoot });
        }

        switch (result.kind) {
          case "initialized": {
            output.success(`Initialized docs directory ${result.docsDir}/`);
            displayInstall(output, result.install.results, verbose);
            break;
          }
          case "adopted": {
            output.success(
              `Adopted ${result.toolCount} tool(s) at version ${result.version}: ${result.totalRegistered} files registered`
            );
            break;
          }
          case "installed": {
            displayInstall(output, result.install.results, verbose);
            break;
          }
          case "up-to-date": {
            if (result.hasAdditionalTools) output.info("All installed tools are up to date.");
            else output.info("Project is up to date.");
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
    });
}
