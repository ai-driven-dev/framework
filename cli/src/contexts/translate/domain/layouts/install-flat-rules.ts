import { reshapeFrontmatter } from "../../../../shared/domain/markdown.js";
import type { FlatArtifactLayout } from "../../../../shared/domain/materialization/flat-paths.js";
import { basename } from "../plugin-paths.js";
import type { ComponentPlan } from "../rules/component-pipeline.js";
import { ruleFilePlan } from "../rules/rule-scope.js";
import type { TranslatedAiTool } from "../translate-profile.js";

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

/** A rule's plan as the tool's flat build places it: its markdown the one its build contract writes. */
export function installedRulePlan(
  plan: ComponentPlan,
  content: string,
  at: { tool: TranslatedAiTool; layout: Pick<FlatArtifactLayout, "rules"> }
): ComponentPlan {
  const rules = at.tool.buildContract("flat")?.artifacts.rules;
  const markdown = rules?.supported ? rules.ruleMarkdown : undefined;
  return ruleFilePlan(plan, content, { layout: at.layout, markdown });
}
