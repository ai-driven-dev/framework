import type { Command } from "commander";
import { aiToolSelectionOf } from "../../../contexts/tools/contract/ai-tool-selection.model.js";
import type { ToolCatalog } from "../../../contexts/tools/contract/tool-catalog.js";
import type { InstallPlugin } from "../../../orchestration/plugin/install-plugin.use-case.js";
import type { SyncNativeActivation } from "../../../orchestration/sync/settings/sync-native-activation.use-case.js";
import { parseScope } from "../../../shared/domain/scope.js";
import { printPluginInstallOutcome } from "../../presenters/plugin/plugin.presenter.js";
import { reportNativeActivation } from "../../presenters/setup/sync.presenter.js";
import { type ContainerFactory, parseGlobalOptions } from "../menu/global-options.controller.js";

/** What installing a plugin reads of the container. */
export interface InstallContainer {
  plugin: { installPlugin: Pick<InstallPlugin, "execute"> };
  marketplace: { syncNativeActivation: Pick<SyncNativeActivation, "execute"> };
}

export interface InstallOptions {
  readonly from?: string;
  readonly tool?: string;
  readonly token?: string;
  readonly scope?: string;
  readonly yes?: boolean;
}

/** The command `install` belongs to, the tools it can target, and how it builds its container. */
interface InstallEnvironment {
  readonly program: Command;
  readonly catalog: ToolCatalog;
  readonly containerOf: ContainerFactory<InstallContainer>;
}

export async function installPluginFrom(
  { program, catalog, containerOf }: InstallEnvironment,
  pluginArg: string | undefined,
  options: InstallOptions
): Promise<void> {
  const { verbose, output, projectRoot } = parseGlobalOptions(program);
  const container = await containerOf(projectRoot, { verbose, token: options.token }, output);
  const result = await container.plugin.installPlugin.execute({
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
    await container.marketplace.syncNativeActivation.execute({
      projectRoot,
      marketplaceNames: options.from !== undefined ? [options.from] : undefined,
    })
  );
  printPluginInstallOutcome(output, result);
}
