import { parseFrontmatter, reshapeFrontmatter } from "../../../../shared/domain/markdown.js";
import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import { basename } from "../plugin-paths.js";
import type { ComponentPlan } from "../rules/component-pipeline.js";
import type { TranslatedFlatPlugin } from "../translate-profile.js";

/** The rules of a tool that applies every rule to every file and reads no frontmatter, each with
 * its paths: none for a rule that applies everywhere. */
export function ruleScopesOf(
  dist: PluginDistribution,
  plugins: TranslatedFlatPlugin
): ReadonlyMap<PluginComponentFile, readonly unknown[]> {
  if (plugins.flatLayout().rules !== "top-level-no-frontmatter") return new Map();
  return new Map(
    dist.components.rules.map((file) => {
      // Limit: `paths` is a list in every shipped rule; a bare string is read as no scope.
      const { paths } = parseFrontmatter(file.content).frontmatter;
      return [file, Array.isArray(paths) ? paths : []];
    })
  );
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

/** A command named `<prefix><plugin>:<name>`, the name its source carries stripped of its own prefix. */
export function prefixCommandName(
  content: string,
  at: { source: string; prefix: string; pluginName: string }
): string {
  return reshapeFrontmatter(content, {
    frontmatter: (frontmatter) => {
      const rawName = typeof frontmatter.name === "string" ? frontmatter.name : "";
      const simpleName = stripCommandPrefix(rawName) || basename(at.source);
      return { ...frontmatter, name: `${at.prefix}${at.pluginName}:${simpleName}` };
    },
  });
}

function stripCommandPrefix(name: string): string {
  const match = /^aidd:\d+:(.+)$/.exec(name);
  if (match) return match[1];
  return name.slice(name.lastIndexOf(":") + 1);
}
