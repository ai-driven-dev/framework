import {
  parseFrontmatter,
  reshapeFrontmatter,
  serializeFrontmatter,
} from "../../../../shared/domain/markdown.js";
import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ComponentPlan } from "../rules/component-pipeline.js";
import type { TranslatedFlatPlugin } from "../translate-profile.js";

/** The rules a tool that applies every rule to every file would broaden, each with its paths. */
export function scopedRulesOf(
  dist: PluginDistribution,
  plugins: TranslatedFlatPlugin
): ReadonlyMap<PluginComponentFile, readonly unknown[]> {
  if (plugins.flatLayout().rules !== "top-level-unscoped") return new Map();
  const scoped = new Map<PluginComponentFile, readonly unknown[]>();
  for (const file of dist.components.rules) {
    const { paths } = parseFrontmatter(file.content).frontmatter;
    const globs = typeof paths === "string" && paths !== "" ? [paths] : paths;
    if (Array.isArray(globs) && globs.length > 0) scoped.set(file, globs);
  }
  return scoped;
}

/** The plan with the rule's scope stated as the first line of its body, the line the rule-generate
 * skill writes, for a tool that reads no `paths` frontmatter. */
export function scopeStated(plan: ComponentPlan, paths: readonly unknown[]): ComponentPlan {
  const line = `Applies to files matching ${paths.map((glob) => `\`${glob}\``).join(", ")}.\n\n`;
  return {
    ...plan,
    shape: (text) =>
      reshapeFrontmatter(text, {
        frontmatter: (frontmatter) => frontmatter,
        serialize: (frontmatter, body) => serializeFrontmatter(frontmatter, line + body),
      }),
  };
}
