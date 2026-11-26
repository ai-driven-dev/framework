import { errorMessage } from "../../../shared/domain/describe-error.js";
import type { PluginDistribution } from "../../../shared/domain/plugin/plugin-distribution.js";
import { McpConfigError } from "../../../shared/domain/shared.error.js";

export const PLUGIN_HOOKS_RELATIVE = "hooks/hooks.json";
export const PLUGIN_AGENT_INPUT_EXT = ".md";
export const PLUGIN_SKILL_ENTRY_FILE = "SKILL.md";

/** Subdirectory names a build warns about and skips. */
export const OUT_OF_SCOPE_PLUGIN_SECTIONS: readonly ["commands", "rules"] = ["commands", "rules"];

/** A plugin's `.mcp.json` as JSON, `undefined` when it declares none. The one reader of it, so a
 * malformed file is refused by plugin name wherever it is read. */
export function parsedMcpDeclaration(canon: PluginDistribution): unknown {
  const [file] = canon.components.mcp;
  if (file === undefined) return undefined;
  try {
    return JSON.parse(file.content);
  } catch (err) {
    throw new McpConfigError(
      `Cannot parse plugin '${canon.manifest.name}' MCP config: ${errorMessage(err)}`
    );
  }
}
