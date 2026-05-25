/**
 * Copilot-supported frontmatter keys for agent files.
 * Order is preserved on serialization for deterministic output (AC #2).
 */
export const COPILOT_AGENT_FRONTMATTER_KEYS: readonly [
  "name",
  "description",
  "model",
  "tools",
  "agents",
  "argument-hint",
] = ["name", "description", "model", "tools", "agents", "argument-hint"];

/**
 * Returns a new object containing only the Copilot-supported frontmatter keys
 * with non-undefined values. Iteration order matches the allowlist constant.
 */
export function stripAgentFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of COPILOT_AGENT_FRONTMATTER_KEYS) {
    if (fm[key] !== undefined) {
      result[key] = fm[key];
    }
  }
  return result;
}
