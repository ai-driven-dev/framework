import { artifactPath } from "../../../../shared/domain/materialization/artifact-path.js";
import type { SupportedArtifact } from "../../../../shared/domain/materialization/build-contract.js";
import { belowSection } from "../../../../shared/domain/materialization/flat-paths.js";
import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ComponentPlan } from "../rules/component-pipeline.js";
import { ruleFilePlan } from "../rules/rule-scope.js";

export function flatRules(canon: PluginDistribution, artifact: SupportedArtifact): ComponentPlan[] {
  const plugin = canon.manifest.name;
  return canon.components.rules.map((file) => flatRulePlan(artifact, plugin, file));
}

/** A rule placed as an install places it, so build and install write the same bytes. */
export function flatRulePlan(
  artifact: SupportedArtifact,
  plugin: string,
  { relativePath, content }: Pick<PluginComponentFile, "relativePath" | "content">
): ComponentPlan {
  const { placement } = artifact;
  const plan = {
    source: relativePath,
    path: artifactPath(artifact, plugin, relativePath),
    content,
    guard: { plugin, name: belowSection("rules", relativePath) },
  };
  return placement.kind === "layout"
    ? ruleFilePlan(plan, content, { layout: placement.layout, markdown: artifact.ruleMarkdown })
    : plan;
}
