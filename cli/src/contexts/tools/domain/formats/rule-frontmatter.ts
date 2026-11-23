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

/** A rule scoped by `paths`, globs renamed to it, an empty list unscoped. */
export function pathsScopedRule(fm: Record<string, unknown>): Record<string, unknown> {
  if ("paths" in fm) {
    const paths = fm.paths;
    if (Array.isArray(paths) && paths.length === 0) return {};
    return { paths };
  }
  if ("globs" in fm) return { paths: fm.globs };
  return descriptionOnlyRule(fm);
}

/** A scoped rule keeps its globs and never applies on its own; an unscoped one survives only as
 * an on-request rule that has a description. */
export function globsScopedRule(fm: Record<string, unknown>): Record<string, unknown> {
  const patterns = rulePatterns(fm);
  const described = fm.description === undefined ? {} : { description: fm.description };
  if (patterns.length > 0) {
    return {
      ...described,
      globs: JSON.stringify(patterns).replace(/,/g, ", "),
      alwaysApply: false,
    };
  }
  return fm.alwaysApply === false && fm.description !== undefined
    ? { ...described, alwaysApply: false }
    : {};
}

/** A markdown rule file renamed to the `.mdc` extension. */
export function toMdc(fileName: string): string {
  return fileName.endsWith(".md") ? `${fileName.slice(0, -3)}.mdc` : fileName;
}
