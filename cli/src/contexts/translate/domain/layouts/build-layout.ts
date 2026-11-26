import { reshapeFrontmatter } from "../../../../shared/domain/markdown.js";
import { artifactPath } from "../../../../shared/domain/materialization/artifact-path.js";
import type {
  SupportedArtifact,
  ToolBuildContract,
} from "../../../../shared/domain/materialization/build-contract.js";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import { PLUGIN_HOOKS_RELATIVE, PLUGIN_MCP_RELATIVE } from "../canon-format.js";
import { agentLinks } from "../rules/agent-markdown.js";
import {
  agentShape,
  type ComponentPlan,
  type PlannedComponents,
} from "../rules/component-pipeline.js";
import { relativeLinks } from "../rules/links.js";
import type { FrameworkBuildMode } from "../translate-profile.js";
import { buildFlatPlans } from "./build-flat.js";
import { agentFiles, baseOf, isEntry } from "./build-shared.js";

/** Where a build puts one plugin for a tool and which rules each file goes through. The files
 * are named from the output directory; a flat layout leaves its MCP servers and hooks file to the
 * sink, which merges them across plugins. */
export function buildPlans(
  canon: PluginDistribution,
  contract: ToolBuildContract,
  mode: FrameworkBuildMode
): PlannedComponents {
  return mode === "flat" ? buildFlatPlans(canon, contract) : marketplacePlans(canon, contract);
}

function marketplacePlans(
  canon: PluginDistribution,
  contract: ToolBuildContract
): PlannedComponents {
  const { agents, hooks, mcp, skills } = contract.artifacts;
  const { pluginRootToken } = contract;
  const hookPlans = hooks.supported
    ? marketplaceHooks(canon, hooks, pluginRootToken)
    : { plans: [], warnings: [] };
  return {
    plans: [
      ...(agents.supported ? marketplaceAgents(canon, agents) : []),
      ...hookPlans.plans,
      ...(mcp.supported ? marketplaceMcp(canon, mcp, pluginRootToken) : []),
      ...(skills.supported ? marketplaceSkills(canon, skills) : []),
    ],
    warnings: hookPlans.warnings,
  };
}

function marketplaceAgents(
  canon: PluginDistribution,
  artifact: SupportedArtifact
): ComponentPlan[] {
  const plugin = canon.manifest.name;
  return agentFiles(canon).map((file) =>
    marketplaceAgentPlan({ plugin, root: `plugins/${plugin}/` }, artifact, file)
  );
}

/** One agent as the marketplace build places and shapes it, under `root`, the plugin's directory.
 * An install of a tool that stages its agents outside `agents/` reuses it. */
export function marketplaceAgentPlan(
  { plugin, root }: { plugin: string; root: string },
  artifact: SupportedArtifact,
  { relativePath, content }: { relativePath: string; content: string }
): ComponentPlan {
  const base = baseOf(relativePath);
  const place = { plugin, outName: base, from: `agents/${base}`, unshaped: "carry" } as const;
  return {
    source: relativePath,
    path: `${root}${artifactPath(artifact, plugin, `agents/${base}`)}`,
    content,
    guard: { plugin, name: relativePath.slice("agents/".length) },
    links: agentLinks(artifact, place),
    shape: agentShape(artifact, place),
  };
}

function marketplaceHooks(
  canon: PluginDistribution,
  artifact: SupportedArtifact,
  rootToken: string | undefined
): PlannedComponents {
  const plugin = canon.manifest.name;
  const warnings: string[] = [];
  const plans = canon.components.hooks.map(({ relativePath, content }) => {
    const converted =
      relativePath === PLUGIN_HOOKS_RELATIVE ? artifact.convertHooks?.(content, plugin) : undefined;
    warnings.push(...(converted?.warnings ?? []));
    return {
      source: relativePath,
      path: `plugins/${plugin}/${hooksPath(artifact, plugin, relativePath)}`,
      content: converted?.content ?? content,
      shape:
        converted === undefined && artifact.transform && relativePath.endsWith(".json")
          ? (text: string) => artifact.transform?.(text, plugin, baseOf(relativePath)) ?? text
          : undefined,
      rootToken,
      script: (text: string) => artifact.script?.(relativePath, text) ?? text,
    };
  });
  return { plans, warnings };
}

// Only the hooks manifest has a place of its own; a script stays where the plugin ships it.
function hooksPath(artifact: SupportedArtifact, plugin: string, relativePath: string): string {
  return relativePath === PLUGIN_HOOKS_RELATIVE
    ? artifactPath(artifact, plugin, relativePath)
    : relativePath;
}

function marketplaceMcp(
  canon: PluginDistribution,
  artifact: SupportedArtifact,
  rootToken: string | undefined
): ComponentPlan[] {
  const plugin = canon.manifest.name;
  return canon.components.mcp.map(({ relativePath, content }) => ({
    source: relativePath,
    path: `plugins/${plugin}/${artifactPath(artifact, plugin, PLUGIN_MCP_RELATIVE)}`,
    content,
    shape: artifact.transform
      ? (text) => artifact.transform?.(text, plugin, PLUGIN_MCP_RELATIVE) ?? text
      : undefined,
    rootToken,
  }));
}

function marketplaceSkills(
  canon: PluginDistribution,
  artifact: SupportedArtifact
): ComponentPlan[] {
  const plugin = canon.manifest.name;
  const { skillFrontmatter } = artifact;
  return canon.components.skills.map(({ relativePath, content }) => {
    const path = `plugins/${plugin}/${relativePath}`;
    if (!relativePath.endsWith(".md")) return { source: relativePath, path, content };
    return {
      source: relativePath,
      path,
      content,
      guard: { plugin, name: relativePath.slice("skills/".length) },
      links: relativeLinks(relativePath),
      shape:
        isEntry(relativePath) && skillFrontmatter
          ? (text) => reshapeFrontmatter(text, { frontmatter: skillFrontmatter })
          : undefined,
    };
  });
}
