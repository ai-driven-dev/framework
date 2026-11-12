/** Paths Kiro scans, the same under a project root and under the home directory. Kept apart from
 * the profile so the build contract and the hooks descriptor share one declaration. */

export const KIRO_DIRECTORY = ".kiro/";
export const KIRO_SKILLS_DIR = `${KIRO_DIRECTORY}skills/`;
export const KIRO_AGENTS_DIR = `${KIRO_DIRECTORY}agents/`;
export const KIRO_MCP_PATH = `${KIRO_DIRECTORY}settings/mcp.json`;
