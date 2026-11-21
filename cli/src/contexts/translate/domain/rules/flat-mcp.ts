import { errorMessage } from "../../../../shared/domain/describe-error.js";
import { flatMcpKeyPrefix } from "../../../../shared/domain/materialization/flat-paths.js";
import { rewritePluginRootInJson } from "../../../../shared/domain/materialization/plugin-root-path-rewrite.js";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import { McpConfigError } from "../../../../shared/domain/shared.error.js";
import type { ToolBuildContract } from "../../../tools/contract/build-contract.js";
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

/** Absent where the plugin declares no MCP file. The sink only merges what this holds. */
export function flatMcp(
  canon: PluginDistribution,
  target: { readonly contract: ToolBuildContract; readonly outDir: string }
): PluginMcp | null {
  const [declaration] = canon.components.mcp;
  if (declaration === undefined) return null;
  const plugin = canon.manifest.name;
  const parsed = parseDeclaration(plugin, declaration.content);
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

function parseDeclaration(plugin: string, content: string): unknown {
  try {
    return JSON.parse(content);
  } catch (err) {
    throw new McpConfigError(`Cannot parse plugin '${plugin}' MCP config: ${errorMessage(err)}`);
  }
}
