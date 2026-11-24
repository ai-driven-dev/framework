import { reshapeFrontmatter } from "../../../../shared/domain/markdown.js";
import { artifactPath } from "../../../../shared/domain/materialization/artifact-path.js";
import type {
  SupportedArtifact,
  ToolBuildContract,
} from "../../../../shared/domain/materialization/build-contract.js";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import { PLUGIN_MCP_RELATIVE } from "../canon-format.js";
import { agentLinks } from "../rules/agent-markdown.js";
import { agentShape, type ComponentPlan } from "../rules/component-pipeline.js";
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
): ComponentPlan[] {
  return mode === "flat" ? buildFlatPlans(canon, contract) : marketplacePlans(canon, contract);
}

function marketplacePlans(canon: PluginDistribution, contract: ToolBuildContract): ComponentPlan[] {
  const { agents, hooks, mcp, skills } = contract.artifacts;
  const { pluginRootToken } = contract;
  return [
    ...(agents.supported ? marketplaceAgents(canon, agents) : []),
    ...(hooks.supported ? marketplaceHooks(canon, hooks, pluginRootToken) : []),
    ...(mcp.supported ? marketplaceMcp(canon, mcp, pluginRootToken) : []),
    ...(skills.supported ? marketplaceSkills(canon, skills) : []),
  ];
}

function marketplaceAgents(
  canon: PluginDistribution,
  artifact: SupportedArtifact
): ComponentPlan[] {
  const plugin = canon.manifest.name;
  return agentFiles(canon).map(({ relativePath, content }) => {
    const base = baseOf(relativePath);
    const place = { plugin, outName: base, from: `agents/${base}`, unshaped: "carry" } as const;
    return {
      source: relativePath,
      path: `plugins/${plugin}/${artifactPath(artifact, plugin, `agents/${base}`)}`,
      content,
      guard: { plugin, name: relativePath.slice("agents/".length) },
      links: agentLinks(artifact, place),
      shape: agentShape(artifact, place),
    };
  });
}

function marketplaceHooks(
  canon: PluginDistribution,
  artifact: SupportedArtifact,
  rootToken: string | undefined
): ComponentPlan[] {
  const plugin = canon.manifest.name;
  return canon.components.hooks.map(({ relativePath, content }) => ({
    source: relativePath,
    path: `plugins/${plugin}/${relativePath}`,
    content,
    shape:
      artifact.transform && relativePath.endsWith(".json")
        ? (text) => artifact.transform?.(text, plugin, baseOf(relativePath)) ?? text
        : undefined,
    rootToken,
    script: (text) => artifact.script?.(relativePath, text) ?? text,
  }));
}

function marketplaceMcp(
  canon: PluginDistribution,
  artifact: SupportedArtifact,
  rootToken: string | undefined
): ComponentPlan[] {
  const plugin = canon.manifest.name;
  return canon.components.mcp.map(({ relativePath, content }) => ({
    source: relativePath,
    path: `plugins/${plugin}/${PLUGIN_MCP_RELATIVE}`,
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
