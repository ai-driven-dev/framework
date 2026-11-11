import { UnresolvableUserScopeError } from "../../../../kernel/errors.js";
import type { AiToolId } from "../../../../kernel/tool.js";
import { AI_TOOL_IDS } from "../../../../kernel/tool.js";
import type { McpCapability } from "../../../tools/domain/capabilities/mcp-capability.js";
import { mcpCapabilityOf, resolvePluginsCapability } from "../../../tools/domain/registry.js";
import { getToolSupportedScope } from "../../domain/install-scope.js";
import type { Manifest } from "../../domain/manifest.js";
import type { PluginScope } from "../../domain/plugins/installed-plugin.js";

export function resolvePluginToolIds(toolIds: AiToolId[] | "all", manifest: Manifest): AiToolId[] {
  if (toolIds !== "all") return toolIds;
  return AI_TOOL_IDS.filter((id) => manifest.hasTool(id)) as AiToolId[];
}

/** The scope a fresh install writes to the manifest, read once from the tool's own profile.
 * Nothing else calls this: every later command reads the scope the manifest already recorded,
 * which the profile can disagree with. */
export function resolveScopeForInstall(toolId: AiToolId): PluginScope {
  return getToolSupportedScope(toolId);
}

/** The base directory a plugin's `files` are relative to, from the manifest's own recorded
 * `scope` — never from the tool's current profile. Throws rather than falling back to `projectRoot`
 * for a `"user"` scope the profile no longer explains: a silent fallback would resolve a
 * suppression, a deletion or a drift check against the wrong directory. */
export function resolveBaseDirFromRecord(
  scope: PluginScope,
  toolId: AiToolId,
  projectRoot: string,
  homedir: () => string
): string {
  if (scope === "project") return projectRoot;
  const dir = resolvePluginsCapability(toolId)?.userPluginsBaseDir(homedir());
  if (dir === null || dir === undefined) throw new UnresolvableUserScopeError(toolId);
  return dir;
}

/** The MCP capability of a tool that merges plugin MCP entries into one shared file it owns
 * the framework half of, or `null` when the tool is not one. */
export function frameworkPrimeFlatMcpOf(toolId: AiToolId): McpCapability | null {
  const mcp = mcpCapabilityOf(toolId);
  if (mcp === null || mcp.params.mergeStrategy !== "framework-prime") return null;
  return resolvePluginsCapability(toolId)?.kind === "flat" ? mcp : null;
}
