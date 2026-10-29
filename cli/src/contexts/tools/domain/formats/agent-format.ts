/** One host's agent frontmatter, written from the Claude-format source. Every host declares
 * exactly one, and every path that installs an agent writes through it, so the plugin
 * install and the built distributions cannot diverge. */
export type AgentFrontmatter = (source: Record<string, unknown>) => Record<string, unknown>;

/** Pick only the given keys, in their order, for deterministic output. A key whose value is
 * undefined is omitted. */
export function pickFrontmatterKeys(
  fm: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (fm[key] !== undefined) result[key] = fm[key];
  }
  return result;
}

/** A host without an effort key reads it from the model id, between `open` and `close`. */
export function modelWithEffort(fm: Record<string, unknown>, open: string, close = ""): unknown {
  if (typeof fm.model !== "string" || typeof fm.effort !== "string") return fm.model;
  return `${fm.model}${open}${fm.effort}${close}`;
}
