/** Copilot-supported frontmatter keys for agent files. Order is preserved on serialization,
 * for deterministic output. */
export const COPILOT_AGENT_FRONTMATTER_KEYS: readonly [
  "name",
  "description",
  "model",
  "reasoningEffort",
  "include-custom-instructions",
] = ["name", "description", "model", "reasoningEffort", "include-custom-instructions"];

/** Cursor-supported frontmatter keys: Cursor documents only name, description and model —
 * never tools or color. */
export const CURSOR_AGENT_FRONTMATTER_KEYS: readonly ["name", "description", "model"] = [
  "name",
  "description",
  "model",
];

/** Keys of a host whose agent ID is its file path (OpenCode, Kilo): no `name`. */
const PATH_ID_AGENT_FRONTMATTER_KEYS: readonly ["description", "model"] = ["description", "model"];

/** Pick only the given keys, preserving their order. A key whose value is undefined is
 * omitted. */
export function pickFrontmatterKeys(
  fm: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (fm[key] !== undefined) {
      result[key] = fm[key];
    }
  }
  return result;
}

/** Copilot reads Claude's `effort` as `reasoningEffort`, and gives a subagent the repository
 * instructions only when `include-custom-instructions` is set. Lossy, so there is no inverse. */
export function stripCopilotAgentFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
  return pickFrontmatterKeys(
    {
      ...fm,
      reasoningEffort: fm.effort,
      "include-custom-instructions": fm["include-custom-instructions"] ?? true,
    },
    COPILOT_AGENT_FRONTMATTER_KEYS
  );
}

/** Only the Cursor-supported keys. Tools, color and argument-hint are discarded. */
export function stripCursorAgentFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
  return pickFrontmatterKeys(fm, CURSOR_AGENT_FRONTMATTER_KEYS);
}

/** OpenCode and Kilo name an agent after its file and give it every tool by default; Kilo
 * passes any unknown key to the model provider, so nothing else is carried. */
export function stripPathIdAgentFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
  return pickFrontmatterKeys(fm, PATH_ID_AGENT_FRONTMATTER_KEYS);
}
