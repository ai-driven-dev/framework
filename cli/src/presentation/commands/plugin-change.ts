import type { Command } from "commander";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { DepsSliceFactory } from "../../orchestration/deps.js";
import { aiToolSelectionOf } from "../../orchestration/domain/ai-tool-selection.model.js";
import { parseScope } from "../../shared/domain/scope.js";
import { printPluginRemoved, printPluginsUpdated } from "../display/plugin-display.js";
import { reportNativeActivation } from "../display/sync-display.js";
import { parseGlobalOptions } from "./global-options.js";

/** What removing or updating a plugin reads of the graph. */
export type ChangeKeys =
  | "pluginRemoveUseCase"
  | "userPluginRemove"
  | "pluginUpdateUseCase"
  | "userPluginUpdateUseCase"
  | "syncNativeActivation";

export interface ChangeOptions {
  readonly tool?: string;
  readonly scope?: string;
}

/** The command a change belongs to, the tools it can target, and how it builds its graph. */
interface ChangeEnvironment {
  readonly program: Command;
  readonly catalog: ToolCatalog;
  readonly createDeps: DepsSliceFactory<ChangeKeys>;
}

/** What every change shares: where it runs, what it reaches, and at which scope. */
async function changeOf(
  { program, catalog, createDeps }: ChangeEnvironment,
  options: ChangeOptions
) {
  const { verbose, output, projectRoot } = parseGlobalOptions(program);
  const scope = parseScope(options.scope) ?? "project";
  const deps = await createDeps(projectRoot, { verbose }, output);
  return {
    output,
    projectRoot,
    scope,
    deps,
    toolIds: aiToolSelectionOf(options.tool, catalog),
    /** A project-scope change re-drives native activation; a user-scope one has none. */
    async reactivate() {
      if (scope === "project") {
        reportNativeActivation(output, await deps.syncNativeActivation.execute({ projectRoot }));
      }
    },
  };
}

export async function removePluginFrom(
  environment: ChangeEnvironment,
  name: string,
  options: ChangeOptions
): Promise<void> {
  const { output, projectRoot, toolIds, scope, deps, reactivate } = await changeOf(
    environment,
    options
  );
  const removal = { pluginName: name, toolIds, projectRoot };
  await (scope === "user" ? deps.userPluginRemove : deps.pluginRemoveUseCase).execute(removal);
  await reactivate();
  printPluginRemoved(output, name);
}

export async function updatePluginsFrom(
  environment: ChangeEnvironment,
  name: string | undefined,
  options: ChangeOptions
): Promise<void> {
  const { output, projectRoot, toolIds, scope, deps, reactivate } = await changeOf(
    environment,
    options
  );
  const update = scope === "user" ? deps.userPluginUpdateUseCase : deps.pluginUpdateUseCase;
  const pluginNames = name !== undefined ? [name] : undefined;
  const updated = await update.execute({ pluginNames, toolIds, projectRoot, scope });
  await reactivate();
  printPluginsUpdated(output, updated);
}
