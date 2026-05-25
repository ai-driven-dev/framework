/**
 * Pure helper that rewrites ${CLAUDE_PLUGIN_ROOT}/<rel> → ./<rel> in every
 * string value of an arbitrary parsed JSON structure (spec §"Hooks" and §"MCP").
 *
 * Recurses through arrays and objects. Rewrites only string VALUES, never keys,
 * so that key names containing the pattern are left untouched (spec §M-v2.4 risk note).
 *
 * No I/O, no path math — plain string prefix substitution.
 */

// Written as a split literal to avoid biome's noTemplateCurlyInString warning.
const CLAUDE_ROOT_PREFIX = "$" + "{CLAUDE_PLUGIN_ROOT}/";
const RELATIVE_PREFIX = "./";

export function rewriteClaudeRootInJson(parsed: unknown): unknown {
  if (typeof parsed === "string") return rewriteStringValue(parsed);
  if (Array.isArray(parsed)) return parsed.map(rewriteClaudeRootInJson);
  if (parsed !== null && typeof parsed === "object")
    return rewriteObject(parsed as Record<string, unknown>);
  return parsed;
}

function rewriteStringValue(value: string): string {
  if (!value.includes(CLAUDE_ROOT_PREFIX)) return value;
  return value.replaceAll(CLAUDE_ROOT_PREFIX, RELATIVE_PREFIX);
}

function rewriteObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = rewriteClaudeRootInJson(value);
  }
  return result;
}
