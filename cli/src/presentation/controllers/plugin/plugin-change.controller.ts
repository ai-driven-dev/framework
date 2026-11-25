import type { Command } from "commander";
import type { UpdatePlugin } from "../../../contexts/installation/application/plugin/update-plugin.use-case.js";
import type { RemoveUserPluginRequest } from "../../../contexts/installation/application/removal/remove-user-plugin.use-case.js";
import { aiToolSelectionOf } from "../../../contexts/tools/contract/ai-tool-selection.model.js";
import type { ToolCatalog } from "../../../contexts/tools/contract/tool-catalog.js";
import type { RemovePlugin } from "../../../orchestration/plugin/remove-plugin.use-case.js";
import type { UpdateUserPlugin } from "../../../orchestration/plugin/update-user-plugin.use-case.js";
import type { SyncNativeActivation } from "../../../orchestration/sync/settings/sync-native-activation.use-case.js";
import { parseScope } from "../../../shared/domain/scope.js";
import {
  printPluginRemoved,
  printPluginsUpdated,
} from "../../presenters/plugin/plugin.presenter.js";
import { reportNativeActivation } from "../../presenters/setup/sync.presenter.js";
import { type ContainerFactory, parseGlobalOptions } from "../menu/global-options.controller.js";

/** What removing or updating a plugin reads of the container. */
export interface ChangeContainer {
  plugin: {
    removePlugin: Pick<RemovePlugin, "execute">;
    /** The user-scope removal, its home directory already bound. */
    userPluginRemove: {
      execute: (options: Omit<RemoveUserPluginRequest, "home" | "records">) => Promise<void>;
    };
    updatePlugin: Pick<UpdatePlugin, "execute">;
    updateUserPlugin: Pick<UpdateUserPlugin, "execute">;
  };
  marketplace: { syncNativeActivation: Pick<SyncNativeActivation, "execute"> };
}

export interface ChangeOptions {
  readonly tool?: string;
  readonly scope?: string;
}

/** The command a change belongs to, the tools it can target, and how it builds its container. */
interface ChangeEnvironment {
  readonly program: Command;
  readonly catalog: ToolCatalog;
  readonly containerOf: ContainerFactory<ChangeContainer>;
}

/** What every change shares: where it runs, what it reaches, and at which scope. */
async function changeOf(
  { program, catalog, containerOf }: ChangeEnvironment,
  options: ChangeOptions
) {
  const { verbose, output, projectRoot } = parseGlobalOptions(program);
  const scope = parseScope(options.scope) ?? "project";
  const container = await containerOf(projectRoot, { verbose }, output);
  return {
    output,
    projectRoot,
    scope,
    container,
    toolIds: aiToolSelectionOf(options.tool, catalog),
    /** A project-scope change re-drives native activation; a user-scope one has none. */
    async reactivate() {
      if (scope === "project") {
        reportNativeActivation(
          output,
          await container.marketplace.syncNativeActivation.execute({ projectRoot })
        );
      }
    },
  };
}

export async function removePluginFrom(
  environment: ChangeEnvironment,
  name: string,
  options: ChangeOptions
): Promise<void> {
  const { output, projectRoot, toolIds, scope, container, reactivate } = await changeOf(
    environment,
    options
  );
  const removal = { pluginName: name, toolIds, projectRoot };
  await (scope === "user"
    ? container.plugin.userPluginRemove
    : container.plugin.removePlugin
  ).execute(removal);
  await reactivate();
  printPluginRemoved(output, name);
}

export async function updatePluginsFrom(
  environment: ChangeEnvironment,
  name: string | undefined,
  options: ChangeOptions
): Promise<void> {
  const { output, projectRoot, toolIds, scope, container, reactivate } = await changeOf(
    environment,
    options
  );
  const pluginNames = name !== undefined ? [name] : undefined;
  const request = { pluginNames, toolIds, projectRoot, scope };
  const outcome =
    scope === "user"
      ? { updated: await container.plugin.updateUserPlugin.execute(request) }
      : await container.plugin.updatePlugin.execute(request);
  await reactivate();
  printPluginsUpdated(output, outcome);
}
