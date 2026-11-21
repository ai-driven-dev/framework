import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ToolBuildContract } from "../../../tools/contract/build-contract.js";
import { flatAgentPath, flatLinkTarget } from "../flat-layout.js";
import { agentShape, type ComponentPlan } from "../rules/component-pipeline.js";
import { flatHookPlans } from "../rules/hook-plans.js";
import { rewriteRelativeLinks } from "../rules/links.js";
import { agentFiles, baseOf, isEntry, type SupportedArtifact } from "./build-shared.js";

/** A flat build's plugin files, in the tool's own folders. Its MCP servers and hooks file are
 * merged across plugins by the sink. */
export function buildFlatPlans(
  canon: PluginDistribution,
  contract: ToolBuildContract
): ComponentPlan[] {
  const { agents, hooks, skills } = contract.artifacts;
  return [
    ...(agents.supported ? flatAgents(canon, contract, agents) : []),
    ...(hooks.supported ? flatHooks(canon, hooks) : []),
    ...(skills.supported ? flatSkills(canon, contract, skills) : []),
  ];
}

function flatAgents(
  canon: PluginDistribution,
  contract: ToolBuildContract,
  artifact: SupportedArtifact
): ComponentPlan[] {
  const plugin = canon.manifest.name;
  return agentFiles(canon).map(({ relativePath, content }) => {
    const base = baseOf(relativePath);
    const path = flatAgentPath(artifact, plugin, base);
    return {
      source: relativePath,
      path,
      content,
      guard: { plugin, name: relativePath },
      shape: agentShape(artifact, {
        plugin,
        outName: base,
        from: path,
        resolveTarget: (rel) => flatLinkTarget(contract, plugin, rel),
        unshaped: "links",
      }),
    };
  });
}

function flatHooks(canon: PluginDistribution, artifact: SupportedArtifact): ComponentPlan[] {
  const plugin = canon.manifest.name;
  return flatHookPlans(canon, {
    place: (relativePath) => artifact.path(plugin, relativePath),
    script: (relativePath, content) => artifact.script?.(relativePath, content) ?? content,
    bridge: artifact.skipHooksJson ? (artifact.hooksBridge ?? null) : null,
    bridgeFirst: true,
    needsManifest: true,
  });
}

function flatSkills(
  canon: PluginDistribution,
  contract: ToolBuildContract,
  artifact: SupportedArtifact
): ComponentPlan[] {
  const plugin = canon.manifest.name;
  return canon.components.skills.map(({ relativePath, content }) => {
    const path = artifact.path(plugin, relativePath);
    if (!relativePath.endsWith(".md")) return { source: relativePath, path, content };
    return {
      source: relativePath,
      path,
      content,
      guard: { plugin, name: relativePath.slice("skills/".length) },
      links: (text) =>
        rewriteRelativeLinks(text, {
          currentFilePluginRelative: path,
          resolveTargetPath: (rel) => flatLinkTarget(contract, plugin, rel),
        }),
      namedAfterFolder: artifact.rewriteSkillName && isEntry(relativePath) ? true : undefined,
    };
  });
}
