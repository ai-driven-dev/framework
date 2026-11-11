/** Canonical path constants for the GitHub Copilot workspace layout, in a file of their own so
 * the profile and the flat-mode build helpers share one source without a cross-layer
 * dependency. */

import { PLUGIN_ROOT_TOKEN } from "../../formats/plugin-root-token.js";

export const COPILOT_WORKSPACE_DIR = ".github/";

/** The variable Copilot expands to an installed plugin's directory in a hooks file. */
export const COPILOT_PLUGIN_ROOT_TOKEN = PLUGIN_ROOT_TOKEN;

export const COPILOT_VSCODE_MCP_PATH = ".vscode/mcp.json";
