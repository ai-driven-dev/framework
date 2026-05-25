import {
  FLAT_AGENT_OUTPUT_EXT,
  FLAT_GITHUB_AGENTS_PREFIX,
  FLAT_GITHUB_HOOKS_PREFIX,
  FLAT_GITHUB_SKILLS_PREFIX,
  FLAT_VSCODE_MCP_PATH,
} from "../models/framework-build.js";

/**
 * Pure path helpers for the flat-mode output layout.
 *
 * Flat mode materialises plugin content directly into a project's workspace
 * (.github/ and .vscode/) bypassing the marketplace tree. All functions are
 * pure (no I/O, no path.resolve — callers join with absOut when needed).
 */

/**
 * Returns the flat-output path for an agent file.
 * Input basename is the original .md filename; output has .agent.md suffix.
 *
 * @param plugin - Plugin name (e.g. "aidd-dev")
 * @param agentBaseName - Source basename without leading path (e.g. "implementer.md")
 */
export function flatAgentPath(plugin: string, agentBaseName: string): string {
  const withoutMd = agentBaseName.endsWith(".md") ? agentBaseName.slice(0, -3) : agentBaseName;
  return `${FLAT_GITHUB_AGENTS_PREFIX}${plugin}/${withoutMd}${FLAT_AGENT_OUTPUT_EXT}`;
}

/**
 * Returns the flat-output path for a skill file (preserves the tree).
 *
 * @param plugin - Plugin name
 * @param skillRelPath - Path relative to the plugin's skills/ directory
 */
export function flatSkillPath(plugin: string, skillRelPath: string): string {
  return `${FLAT_GITHUB_SKILLS_PREFIX}${plugin}/${skillRelPath}`;
}

/**
 * Returns the flat-output path for the per-plugin hooks JSON file.
 * Each plugin gets its own file to avoid cross-plugin collisions.
 */
export function flatHooksFile(plugin: string): string {
  return `${FLAT_GITHUB_HOOKS_PREFIX}${plugin}.hooks.json`;
}

/**
 * Returns the flat-output path for a sibling script file shipped alongside
 * the plugin's hooks.json (e.g. "check.sh" → ".github/hooks/<plugin>/check.sh").
 *
 * @param plugin       - Plugin name
 * @param scriptRelPath - Path relative to the plugin's hooks/ directory (not hooks.json itself)
 */
export function flatHooksScriptPath(plugin: string, scriptRelPath: string): string {
  return `${FLAT_GITHUB_HOOKS_PREFIX}${plugin}/${scriptRelPath}`;
}

/**
 * Returns the key prefix used when merging a plugin's MCP servers
 * into .vscode/mcp.json. Includes trailing dash.
 */
export function flatMcpKeyPrefix(plugin: string): string {
  return `${plugin}-`;
}

/**
 * Returns the path to the shared .vscode/mcp.json file (workspace MCP config).
 */
export const FLAT_MCP_OUTPUT_PATH = FLAT_VSCODE_MCP_PATH;

/**
 * Resolves a ${CLAUDE_PLUGIN_ROOT}/<suffix> reference for flat mode.
 *
 * Used as the `substitute` callback for rewriteClaudeRootInJson:
 * - hooks (mode "relative"): returns a workspace-relative path using "./" prefix
 * - mcp (mode "absolute"): returns an absolute path under absOut
 *
 * First-path-segment dispatch:
 * - "agents/<X>" → .github/agents/<plugin>/<X-with-.agent.md> (relative or abs)
 * - "skills/<X>" → .github/skills/<plugin>/<X>
 * - "hooks/<X>"  → .github/hooks/<plugin>/<X> (per-plugin subdir)
 * - other        → .github/<rest> (defensive; warn is caller's responsibility)
 *
 * @param suffix  - Everything after ${CLAUDE_PLUGIN_ROOT}/ (e.g. "skills/foo/SKILL.md")
 * @param plugin  - Plugin name
 * @param mode    - "relative" (hooks) or "absolute" (mcp)
 * @param absOut  - Absolute project root path (required when mode === "absolute")
 */
export function resolveClaudeRootSuffixForFlat(
  suffix: string,
  plugin: string,
  mode: "relative" | "absolute",
  absOut?: string
): string {
  const flatPath = resolveFlatPath(suffix, plugin);
  if (mode === "relative") return `./${flatPath}`;
  if (!absOut) throw new Error("absOut is required for absolute MCP path resolution");
  return `${absOut}/${flatPath}`;
}

function resolveFlatPath(suffix: string, plugin: string): string {
  if (suffix.startsWith("agents/")) {
    const rest = suffix.slice("agents/".length);
    const withoutMd = rest.endsWith(".md") ? rest.slice(0, -3) : rest;
    return `${FLAT_GITHUB_AGENTS_PREFIX}${plugin}/${withoutMd}${FLAT_AGENT_OUTPUT_EXT}`;
  }
  if (suffix.startsWith("skills/")) {
    const rest = suffix.slice("skills/".length);
    return `${FLAT_GITHUB_SKILLS_PREFIX}${plugin}/${rest}`;
  }
  if (suffix.startsWith("hooks/")) {
    const rest = suffix.slice("hooks/".length);
    return `${FLAT_GITHUB_HOOKS_PREFIX}${plugin}/${rest}`;
  }
  // Defensive default for unknown sections (commands/, rules/, scripts/, etc.)
  return `.github/${suffix}`;
}
