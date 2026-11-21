import { flatMcpKeyPrefix } from "../../../../shared/domain/materialization/flat-paths.js";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";

/** A plugin's MCP servers as a flat tool holds them, each key prefixed with the plugin's name so
 * plugins never share one. Absent where the plugin declares no MCP file. The servers are merged
 * into the tool's own file by the sink, which resolves the plugin root they point at. */
export function flatMcpServers(canon: PluginDistribution): Record<string, unknown> | null {
  const [declaration] = canon.components.mcp;
  if (declaration === undefined) return null;
  const servers = asPlainObject(asPlainObject(JSON.parse(declaration.content))?.mcpServers) ?? {};
  const prefix = flatMcpKeyPrefix(canon.manifest.name);
  return Object.fromEntries(
    Object.entries(servers).map(([key, value]) => [`${prefix}${key}`, value])
  );
}
