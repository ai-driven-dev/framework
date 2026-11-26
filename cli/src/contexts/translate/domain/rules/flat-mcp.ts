import type { ToolBuildContract } from "../../../../shared/domain/materialization/build-contract.js";
import { flatMcpKeyPrefix } from "../../../../shared/domain/materialization/flat-paths.js";
import { rewritePluginRootInJson } from "../../../../shared/domain/materialization/plugin-root-path-rewrite.js";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import { parsedMcpDeclaration } from "../canon-format.js";
import { flatPluginRootAbsolute } from "../flat-layout.js";

/** A plugin's MCP declaration as a flat tool holds it, every plugin-root reference already
 * resolved into the output. */
export interface PluginMcp {
  /** The plugin's servers, each key prefixed with the plugin's name so plugins never share one. */
  readonly servers: Readonly<Record<string, unknown>>;
  /** The whole declaration with the same prefixed keys, for a config built from every plugin at
   * once: the one place a key is prefixed, so a config never prefixes it again. */
  readonly declared: string;
}

/** Whether a flat build folds a plugin's MCP declaration into the tool's files. */
export function foldsFlatMcp(contract: ToolBuildContract): boolean {
  const { mcp } = contract.artifacts;
  return (
    (mcp.supported && mcp.mcpServersKey !== undefined) || contract.configArtifact !== undefined
  );
}

/** Absent where the plugin declares no MCP file. The sink only merges what this holds. */
export function flatMcp(
  canon: PluginDistribution,
  target: { readonly contract: ToolBuildContract; readonly outDir: string }
): PluginMcp | null {
  if (canon.components.mcp.length === 0) return null;
  const plugin = canon.manifest.name;
  const parsed = parsedMcpDeclaration(canon);
  const rooted = (value: unknown) =>
    rewritePluginRootInJson(value, (suffix) => flatPluginRootAbsolute(target, suffix, plugin));
  const whole = asPlainObject(rooted(parsed)) ?? {};
  const prefix = flatMcpKeyPrefix(plugin);
  const servers = Object.fromEntries(
    Object.entries(asPlainObject(whole.mcpServers) ?? {}).map(([key, value]) => [
      `${prefix}${key}`,
      value,
    ])
  );
  const prefixed = "mcpServers" in whole ? { ...whole, mcpServers: servers } : whole;
  return { servers, declared: JSON.stringify(prefixed) };
}
