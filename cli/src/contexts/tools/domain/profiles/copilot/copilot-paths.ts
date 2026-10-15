import { join } from "node:path";

/** Canonical path constants for the GitHub Copilot workspace layout, in a file of their own so
 * the profile and the flat-mode build helpers share one source without a cross-layer
 * dependency. */

export const COPILOT_WORKSPACE_DIR = ".github/";

export const COPILOT_VSCODE_MCP_PATH = ".vscode/mcp.json";

export const COPILOT_MARKETPLACE_RELATIVE = ".plugin/marketplace.json";
export function copilotConfigDir(home: string, env: NodeJS.ProcessEnv): string {
  return env.COPILOT_HOME || join(home, ".copilot");
}
