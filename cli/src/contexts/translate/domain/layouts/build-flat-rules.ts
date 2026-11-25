import { artifactPath } from "../../../../shared/domain/materialization/artifact-path.js";
import type { SupportedArtifact } from "../../../../shared/domain/materialization/build-contract.js";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ComponentPlan } from "../rules/component-pipeline.js";
import { ruleScope, scopeStated } from "../rules/rule-scope.js";

/** A rule of a tool that reads no frontmatter, placed and scoped the one way an install does. */
export function flatRules(canon: PluginDistribution, artifact: SupportedArtifact): ComponentPlan[] {
  const plugin = canon.manifest.name;
  return canon.components.rules.map(({ relativePath, content }) => ({
    ...scopeStated(
      { source: relativePath, path: artifactPath(artifact, plugin, relativePath), content },
      ruleScope(content)
    ),
    guard: { plugin, name: relativePath.slice("rules/".length) },
  }));
}
