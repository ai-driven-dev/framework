import { reshapeFrontmatter } from "../../../../shared/domain/markdown.js";
import { statesRuleScope } from "../../../../shared/domain/materialization/flat-paths.js";
import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import { basename } from "../plugin-paths.js";
import { ruleScope } from "../rules/rule-scope.js";
import type { TranslatedFlatPlugin } from "../translate-profile.js";

/** The rules of a tool that applies every rule to every file and reads no frontmatter, each with
 * its paths: none for a rule that applies everywhere. */
export function ruleScopesOf(
  dist: PluginDistribution,
  plugins: TranslatedFlatPlugin
): ReadonlyMap<PluginComponentFile, readonly unknown[]> {
  if (!statesRuleScope(plugins.flatLayout())) return new Map();
  return new Map(dist.components.rules.map((file) => [file, ruleScope(file.content)]));
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
