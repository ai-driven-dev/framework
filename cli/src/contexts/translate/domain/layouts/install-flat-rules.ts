import type { FlatArtifactLayout } from "../../../../shared/domain/materialization/flat-paths.js";
import type { ComponentPlan } from "../rules/component-pipeline.js";
import { ruleFilePlan } from "../rules/rule-scope.js";
import type { TranslatedAiTool } from "../translate-profile.js";

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
