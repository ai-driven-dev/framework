import { UnresolvableUserScopeError } from "../../../../kernel/errors.js";
import type { AiToolId } from "../../../../kernel/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import { getToolSupportedScope } from "../../domain/install-scope.js";
import type { Manifest } from "../../domain/manifest.js";
import type { PluginScope } from "../../domain/plugins/installed-plugin.js";

export function resolvePluginToolIds(
  toolIds: AiToolId[] | "all",
  manifest: Manifest,
  tools: ToolCatalog
): AiToolId[] {
  if (toolIds !== "all") return toolIds;
  return tools.aiIdsInCanonicalOrder().filter((id) => manifest.hasTool(id));
}

/** The scope a fresh install writes to the manifest, read once from the tool's own profile.
 * Nothing else calls this: every later command reads the scope the manifest already recorded,
 * which the profile can disagree with. */
export function resolveScopeForInstall(tool: AiToolProfile): PluginScope {
  return getToolSupportedScope(tool.plugins()?.requiresUserScope() === true);
}

/** The base directory a plugin's `files` are relative to, from the manifest's own recorded
 * `scope` — never from the tool's current profile. Throws rather than falling back to `projectRoot`
 * for a `"user"` scope the profile no longer explains: a silent fallback would resolve a
 * suppression, a deletion or a drift check against the wrong directory. */
export function resolveBaseDirFromRecord(
  scope: PluginScope,
  tool: AiToolProfile,
  projectRoot: string,
  homedir: () => string
): string {
  if (scope === "project") return projectRoot;
  const dir = tool.plugins()?.userPluginsBaseDir(homedir());
  if (dir === null || dir === undefined) throw new UnresolvableUserScopeError(tool.toolId);
  return dir;
}
