import { rulePatterns } from "../../../../shared/domain/markdown.js";

function describedRule(fm: Record<string, unknown>): Record<string, unknown> {
  return fm.description === undefined ? {} : { description: fm.description };
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
  const described = describedRule(fm);
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

/** A markdown rule file installed where `install` puts it, renamed to the `.mdc` extension. */
export function asMdc(install: (fileName: string) => string): (fileName: string) => string {
  return (fileName) => {
    const path = install(fileName);
    return path.endsWith(".md") ? `${path.slice(0, -3)}.mdc` : path;
  };
}

/** A rule for Kiro, which reads an `inclusion` mode: always, or `fileMatch` with the patterns of the
 * rule's `paths` (https://kiro.dev/docs/steering/).
 * A rule scoped by `globs` is scoped the same as one by `paths`.
 *
 * Limit: `alwaysApply` is not read, so a rule that opts out of it is always included. */
export function inclusionModesRule(fm: Record<string, unknown>): Record<string, unknown> {
  const paths = rulePatterns(fm);
  return paths.length === 0
    ? { inclusion: "always" }
    : { inclusion: "fileMatch", fileMatchPattern: paths };
}

/** A rule for Antigravity, which reads a `trigger`: always on, or `glob` with the rule's `paths` as
 * one comma-joined string, its description kept (https://antigravity.google/docs/rules).
 *
 * Limit: only the always-on trigger was observed reaching the model; the glob trigger follows the docs.
 * Limit: `alwaysApply` is not read, so a rule that opts out of it is always on; a glob holding a
 * comma, such as a brace group, splits once joined. */
export function activationTriggersRule(fm: Record<string, unknown>): Record<string, unknown> {
  const paths = rulePatterns(fm);
  const described = describedRule(fm);
  return paths.length === 0
    ? { ...described, trigger: "always_on" }
    : { ...described, trigger: "glob", globs: paths.join(", ") };
}
