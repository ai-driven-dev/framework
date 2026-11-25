import { parseFrontmatter, reshapeFrontmatter } from "../../../../shared/domain/markdown.js";
import {
  type FlatArtifactLayout,
  statesRuleScope,
} from "../../../../shared/domain/materialization/flat-paths.js";
import type { ComponentPlan } from "./component-pipeline.js";

/** The globs a rule applies to, none for a rule that applies everywhere.
 *
 * Limit: `paths` is a list in every shipped rule; a bare string is read as no scope. */
export function ruleScope(content: string): readonly unknown[] {
  const { paths } = parseFrontmatter(content).frontmatter;
  return Array.isArray(paths) ? paths : [];
}

/** A rule's plan on every route that places it: for a tool that reads no frontmatter, the scope is
 * stated as the first line of the body; any other tool carries the rule as shipped.
 *
 * Limit: the install route also rewrites a path a rule mentions to the tool's link syntax and the
 * build does not, so a rule carrying such a path is written with other bytes. No shipped rule
 * carries one; a plugin that does must give the build the install's link form first. */
export function ruleFilePlan(
  plan: ComponentPlan,
  content: string,
  layout: Pick<FlatArtifactLayout, "rules">
): ComponentPlan {
  return statesRuleScope(layout) ? scopeStated(plan, ruleScope(content)) : plan;
}

/** The plan with no frontmatter and the rule's scope as the first line of its body: the one place a
 * tool that reads no frontmatter can take it from. */
function scopeStated(plan: ComponentPlan, paths: readonly unknown[]): ComponentPlan {
  const line =
    paths.length === 0
      ? ""
      : `Applies to files matching ${paths.map((glob) => `\`${glob}\``).join(", ")}.\n\n`;
  return {
    ...plan,
    shape: (text) =>
      reshapeFrontmatter(text, {
        frontmatter: () => ({}),
        serialize: (_, body) => line + body,
      }),
  };
}
