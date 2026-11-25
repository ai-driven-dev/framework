import { artifactPath } from "../../../../shared/domain/materialization/artifact-path.js";
import type { SupportedArtifact } from "../../../../shared/domain/materialization/build-contract.js";
import {
  belowSection,
  statesRuleScope,
} from "../../../../shared/domain/materialization/flat-paths.js";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ComponentPlan } from "../rules/component-pipeline.js";
import { ruleScope, scopeStated } from "../rules/rule-scope.js";

/** A rule placed the way an install places it, its scope stated in its body only for a tool that
 * reads no frontmatter.
 *
 * Limit: the install route also rewrites a path a rule mentions to the tool's link syntax, and this
 * build does not, so a rule carrying such a path is written with other bytes. No shipped plugin has
 * rules carrying one; a plugin that does must give this the install's link form first. */
export function flatRules(canon: PluginDistribution, artifact: SupportedArtifact): ComponentPlan[] {
  const plugin = canon.manifest.name;
  const stated = artifact.placement.kind === "layout" && statesRuleScope(artifact.placement.layout);
  return canon.components.rules.map(({ relativePath, content }) => {
    const plan = {
      source: relativePath,
      path: artifactPath(artifact, plugin, relativePath),
      content,
    };
    return {
      ...(stated ? scopeStated(plan, ruleScope(content)) : plan),
      guard: { plugin, name: belowSection("rules", relativePath) },
    };
  });
}
