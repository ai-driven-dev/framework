/** The glob patterns a rule scopes itself to, `paths` before `globs`; none when it declares neither. */
export function rulePatterns(fm: Record<string, unknown>): unknown[] {
  if (Array.isArray(fm.paths)) return fm.paths;
  return Array.isArray(fm.globs) ? fm.globs : [];
}

/** A rule the tool applies by itself, so only an on-request rule keeps anything, its description. */
export function descriptionOnlyRule(fm: Record<string, unknown>): Record<string, unknown> {
  return fm.alwaysApply === false && fm.description !== undefined
    ? { description: fm.description }
    : {};
}
