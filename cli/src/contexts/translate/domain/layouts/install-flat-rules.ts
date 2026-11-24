import { parseFrontmatter, reshapeFrontmatter } from "../../../../shared/domain/markdown.js";
import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ComponentPlan } from "../rules/component-pipeline.js";
import type { TranslatedFlatPlugin } from "../translate-profile.js";

/** The rules of a tool that applies every rule to every file and reads no frontmatter, each with
 * its paths: none for a rule that applies everywhere. */
export function ruleScopesOf(
  dist: PluginDistribution,
  plugins: TranslatedFlatPlugin
): ReadonlyMap<PluginComponentFile, readonly unknown[]> {
  if (plugins.flatLayout().rules !== "top-level-unscoped") return new Map();
  return new Map(
    dist.components.rules.map((file) => {
      const { paths } = parseFrontmatter(file.content).frontmatter;
      const globs = typeof paths === "string" && paths !== "" ? [paths] : paths;
      return [file, Array.isArray(globs) ? globs : []];
    })
  );
}

/** The plan with no frontmatter and the rule's scope stated as the first line of its body, the
 * form the rule-generate skill writes for a tool that reads no frontmatter. */
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
