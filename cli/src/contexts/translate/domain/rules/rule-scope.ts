import { parseFrontmatter, reshapeFrontmatter } from "../../../../shared/domain/markdown.js";
import type { ComponentPlan } from "./component-pipeline.js";

/** The globs a rule applies to, none for a rule that applies everywhere.
 *
 * Limit: `paths` is a list in every shipped rule; a bare string is read as no scope. */
export function ruleScope(content: string): readonly unknown[] {
  const { paths } = parseFrontmatter(content).frontmatter;
  return Array.isArray(paths) ? paths : [];
}

/** The plan with no frontmatter and the rule's scope stated as the first line of its body: the one
 * place a tool that reads no frontmatter can take it from. */
export function scopeStated(plan: ComponentPlan, paths: readonly unknown[]): ComponentPlan {
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
