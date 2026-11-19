import type { Scope } from "../../../../shared/domain/scope.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { getToolSupportedScope } from "../../domain/install-scope.js";
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
