import { getToolSupportedScope, type Scope } from "../../../../shared/domain/scope.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { resolveScopeBase } from "../../domain/manifest/scope-base.js";
import type { Manifest } from "../../domain/manifest.js";
import type { PluginPlacement } from "../../ports/tool-sections.js";

export function resolvePluginToolIds(
  toolIds: AiToolId[] | "all",
  manifest: Manifest,
  tools: ToolCatalog
): AiToolId[] {
  if (toolIds !== "all") return toolIds;
  return tools.idsInCanonicalOrder("ai").filter((id) => manifest.hasTool(id));
}

/** The scope a fresh install writes to the manifest, read once from the tool's own profile.
 * Nothing else calls this: every later command reads the scope the manifest already recorded,
 * which the profile can disagree with. */
export function resolveScopeForInstall(tool: PluginPlacement): Scope {
  return getToolSupportedScope(tool.plugins()?.requiresUserScope() === true);
}

/** The scope a fresh install writes, for each tool of the catalog. */
export function supportedScopeOf(tools: ToolCatalog): (toolId: AiToolId) => Scope {
  return (toolId) => resolveScopeForInstall(tools.aiProfile(toolId));
}

/** The directory a plugin is installed under for the scope the manifest recorded. The home
 * directory is read only when that scope is "user". */
export function scopeBaseOf(
  tool: PluginPlacement,
  query: { scope: Scope; projectRoot: string; homedir: () => string }
): string {
  return resolveScopeBase({
    scope: query.scope,
    projectRoot: query.projectRoot,
    userBaseDir: () => tool.plugins()?.userPluginsBaseDir(query.homedir()),
    toolId: tool.toolId,
  });
}

/** The machine-scope plugins a user-scope update covers: every one, or only the ones named. */
export function userPluginTargets(
  manifest: Manifest,
  toolIds: readonly AiToolId[],
  pluginNames: readonly string[] | undefined
) {
  return toolIds.flatMap((toolId) =>
    manifest
      .getRecordedPlugins(toolId)
      .filter(
        ({ plugin }) =>
          plugin.scope === "user" &&
          (pluginNames === undefined || pluginNames.includes(plugin.name))
      )
      .map((plugin) => ({ toolId, plugin }))
  );
}
