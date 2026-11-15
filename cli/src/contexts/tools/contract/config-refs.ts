import type { IdeToolId } from "../../../shared/domain/tool.js";

export interface ConfigRef {
  readonly name: string;
  readonly path: string;
  readonly requiredIdeId?: IdeToolId;
}

/** The directory of the canonical source that holds every config artifact. */
export const CONFIG_PREFIX = "config/";

/** The config artifact every tool with an mcp file takes in: named in its `consumes` list, and
 * found in the canonical source at `path`. */
export const CONFIG_MCP = "mcp";
export const MCP_CONFIG_REF: ConfigRef = { name: CONFIG_MCP, path: `${CONFIG_PREFIX}mcp.json` };
