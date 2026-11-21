import type { PluginDistribution } from "../../../../../shared/domain/plugin/plugin-distribution.js";
import { VersionMismatchError } from "../../../../../shared/domain/shared.error.js";
import type { AiToolId } from "../../../../../shared/domain/tool.js";
import { DuplicatePluginError } from "../../../domain/installation.error.js";
import type { Manifest } from "../../../domain/manifest.js";
import type { ProjectHooksProvenance } from "../../../domain/plugins/installed-plugin.js";

/** What an earlier install of the same plugin left behind, per tool, for the new one to supersede. */
export interface PreviousInstall {
  readonly mcpEntries: Map<AiToolId, ReadonlyMap<string, string>>;
  readonly projectHooks: Map<AiToolId, ProjectHooksProvenance>;
}

export function previousInstall(
  pluginName: string,
  toolIds: readonly AiToolId[],
  manifest: Manifest
): PreviousInstall {
  const mcpEntries = new Map<AiToolId, ReadonlyMap<string, string>>();
  const projectHooks = new Map<AiToolId, ProjectHooksProvenance>();
  for (const toolId of toolIds) {
    const existing = manifest.getPlugins(toolId).find((p) => p.name === pluginName);
    if (existing === undefined) continue;
    if (existing.mcpEntries.size > 0) mcpEntries.set(toolId, existing.mcpEntries);
    if (existing.projectHooks !== undefined) projectHooks.set(toolId, existing.projectHooks);
  }
  return { mcpEntries, projectHooks };
}

export function assertNoDuplicates(
  pluginName: string,
  toolIds: readonly AiToolId[],
  manifest: Manifest
): void {
  for (const toolId of toolIds) {
    if (manifest.getPlugins(toolId).some((p) => p.name === pluginName)) {
      throw new DuplicatePluginError(pluginName);
    }
  }
}

export function dropExistingPlugin(
  pluginName: string,
  toolIds: readonly AiToolId[],
  manifest: Manifest
): void {
  for (const toolId of toolIds) manifest.withoutPlugin(toolId, pluginName);
}

/** A pinned version must be the one the source actually carries. */
export function assertRequestedVersion(
  dist: PluginDistribution,
  requested: string | undefined
): void {
  const { name, version } = dist.manifest;
  if (requested && version !== requested) throw new VersionMismatchError(name, requested, version);
}
