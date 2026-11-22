import type { Command } from "commander";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { DepsSliceFactory } from "../../orchestration/deps.js";
import { aiToolSelectionOf } from "../../orchestration/domain/ai-tool-selection.model.js";
import { parseScope } from "../../shared/domain/scope.js";
import { printPluginInstallOutcome } from "../presenters/plugin/plugin.presenter.js";
import { reportNativeActivation } from "../presenters/setup/sync.presenter.js";
import { parseGlobalOptions } from "./global-options.controller.js";

/** What installing a plugin reads of the graph. */
export type InstallKeys = "pluginInstallUseCase" | "syncNativeActivation";

export interface InstallOptions {
  readonly from?: string;
  readonly tool?: string;
  readonly token?: string;
  readonly scope?: string;
  readonly yes?: boolean;
}

/** The command `install` belongs to, the tools it can target, and how it builds its graph. */
interface InstallEnvironment {
  readonly program: Command;
  readonly catalog: ToolCatalog;
  readonly createDeps: DepsSliceFactory<InstallKeys>;
}

export async function installPluginFrom(
  { program, catalog, createDeps }: InstallEnvironment,
  pluginArg: string | undefined,
  options: InstallOptions
): Promise<void> {
  const { verbose, output, projectRoot } = parseGlobalOptions(program);
  const deps = await createDeps(projectRoot, { verbose, token: options.token }, output);
  const result = await deps.pluginInstallUseCase.execute({
    pluginArg,
    toolIds: aiToolSelectionOf(options.tool, catalog),
    projectRoot,
    interactive: process.stdout.isTTY,
    fromMarketplace: options.from,
    yes: options.yes,
    scope: parseScope(options.scope),
  });
  reportNativeActivation(
    output,
    await deps.syncNativeActivation.execute({
      projectRoot,
      marketplaceNames: options.from !== undefined ? [options.from] : undefined,
    })
  );
  printPluginInstallOutcome(output, result);
}
