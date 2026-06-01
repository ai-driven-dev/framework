/**
 * Tool-agnostic flat path primitives.
 *
 * All functions are pure (no I/O). Parameterized by a primary-dir prefix so that
 * claude, cursor, copilot, opencode, and codex all share the same path derivation
 * logic with different prefixes/extensions.
 */

/**
 * Returns the flat-output path for an agent file.
 * The source `.md` extension is stripped and replaced with `outputExt`.
 *
 * Flat mode is BARE single level: no `<plugin>/` segment so tools that
 * require a flat agents directory (cursor, copilot, claude, opencode) can
 * discover the files.
 *
 * @param agentsPrefix - Full prefix for agents dir (e.g. ".github/agents/", ".claude/agents/")
 * @param plugin       - Plugin name (kept for API compat; not included in path)
 * @param agentBaseName - Source basename without path (e.g. "implementer.md")
 * @param outputExt    - Output extension (e.g. ".agent.md", ".md")
 */
export function genericFlatAgentPath(
  agentsPrefix: string,
  _plugin: string,
  agentBaseName: string,
  outputExt: string
): string {
  const withoutMd = agentBaseName.endsWith(".md") ? agentBaseName.slice(0, -3) : agentBaseName;
  return `${agentsPrefix}${withoutMd}${outputExt}`;
}

/**
 * Returns the flat-output path for a skill file (preserves the skill's internal subtree).
 *
 * Flat mode is BARE single level: the skill's own folder (e.g. `01-plan/`) sits
 * directly under the skills root, removing the interposed `<plugin>/` level so
 * tools can discover skills at the expected depth.
 *
 * @param skillsPrefix - Full prefix for skills dir (e.g. ".github/skills/", ".claude/skills/")
 * @param plugin       - Plugin name (kept for API compat; not included in path)
 * @param skillRelPath - Path relative to the plugin's skills/ directory
 */
export function genericFlatSkillPath(
  skillsPrefix: string,
  _plugin: string,
  skillRelPath: string
): string {
  return `${skillsPrefix}${skillRelPath}`;
}

/**
 * Returns the flat-output path for the per-plugin hooks JSON file.
 *
 * @param hooksPrefix - Full prefix for hooks dir (e.g. ".github/hooks/")
 * @param plugin      - Plugin name
 */
export function genericFlatHooksFile(hooksPrefix: string, plugin: string): string {
  return `${hooksPrefix}${plugin}.hooks.json`;
}

/**
 * Returns the flat-output path for a sibling hooks script file.
 *
 * @param hooksPrefix   - Full prefix for hooks dir
 * @param plugin        - Plugin name
 * @param scriptRelPath - Path relative to the plugin's hooks/ directory
 */
export function genericFlatHooksScriptPath(
  hooksPrefix: string,
  plugin: string,
  scriptRelPath: string
): string {
  return `${hooksPrefix}${plugin}/${scriptRelPath}`;
}

/**
 * Returns the key prefix used when merging a plugin's MCP servers.
 * Includes trailing dash.
 */
export function flatMcpKeyPrefix(plugin: string): string {
  return `${plugin}-`;
}
