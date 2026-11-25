import { artifactPath } from "../../../../shared/domain/materialization/artifact-path.js";
import type { SupportedArtifact } from "../../../../shared/domain/materialization/build-contract.js";
import { belowSection } from "../../../../shared/domain/materialization/flat-paths.js";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ComponentPlan } from "../rules/component-pipeline.js";
import { ruleFilePlan } from "../rules/rule-scope.js";

/** A rule placed the way an install places it. */
export function flatRules(canon: PluginDistribution, artifact: SupportedArtifact): ComponentPlan[] {
  const plugin = canon.manifest.name;
  const { placement } = artifact;
  return canon.components.rules.map(({ relativePath, content }) => {
    const plan = {
      source: relativePath,
      path: artifactPath(artifact, plugin, relativePath),
      content,
      guard: { plugin, name: belowSection("rules", relativePath) },
    };
    return placement.kind === "layout"
      ? ruleFilePlan(plan, content, { layout: placement.layout, markdown: artifact.ruleMarkdown })
      : plan;
  });
}
