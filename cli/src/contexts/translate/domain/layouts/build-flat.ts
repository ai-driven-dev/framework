import { artifactPath } from "../../../../shared/domain/materialization/artifact-path.js";
import type {
  SupportedArtifact,
  ToolBuildContract,
} from "../../../../shared/domain/materialization/build-contract.js";
import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import { PLUGIN_HOOKS_RELATIVE } from "../canon-format.js";
import { flatAgentPath, flatCommandFolders, flatLinkTarget } from "../flat-layout.js";
import { agentLinks } from "../rules/agent-markdown.js";
import { agentShape, type ComponentPlan } from "../rules/component-pipeline.js";
import { foldsFlatMcp } from "../rules/flat-mcp.js";
import { relativeLinks } from "../rules/links.js";
import { flatHooks } from "./build-flat-hooks.js";
import { flatRules } from "./build-flat-rules.js";
import { agentFiles, baseOf, namedByFolder } from "./build-shared.js";

/** A flat build's files and its bridge's warnings; the sink merges its MCP servers and hooks file. */
export function buildFlatPlans(canon: PluginDistribution, contract: ToolBuildContract) {
  const { agents, hooks, rules, skills } = contract.artifacts;
  const hookPlans = hooks.supported ? flatHooks(canon, hooks) : { plans: [], warnings: [] };
  return {
    plans: [
      ...flatCommandFiles(canon, contract),
      ...(agents.supported ? flatAgents(canon, contract, agents) : []),
      ...hookPlans.plans,
      ...(skills.supported ? flatSkills(canon, contract, skills) : []),
      ...(rules?.supported ? flatRules(canon, rules) : []),
    ],
    warnings: hookPlans.warnings,
  };
}

/** The folders a plugin's hook and MCP commands name that the tool has no place for, copied whole
 * under the plugin's name: only those, never every extra folder. */
function flatCommandFiles(canon: PluginDistribution, contract: ToolBuildContract): ComponentPlan[] {
  const { hooks } = contract.artifacts;
  const plugin = canon.manifest.name;
  const commands = [
    ...(hooks.supported ? canon.components.hooks.filter(isHooksManifest) : []),
    ...(foldsFlatMcp(contract) ? canon.components.mcp : []),
  ];
  const folders = new Set(
    commands.flatMap((file) => flatCommandFolders(contract, file.content, plugin))
  );
  return canon.files
    .filter(
      ({ relativePath }) => folders.has(relativePath.split("/")[0]) && relativePath.includes("/")
    )
    .map(({ relativePath, content }) => ({
      source: relativePath,
      path: `${plugin}/${relativePath}`,
      content,
    }));
}

const isHooksManifest = (file: PluginComponentFile): boolean =>
  file.relativePath === PLUGIN_HOOKS_RELATIVE;

function flatAgents(
  canon: PluginDistribution,
  contract: ToolBuildContract,
  artifact: SupportedArtifact
): ComponentPlan[] {
  const plugin = canon.manifest.name;
  return agentFiles(canon).map((file) => ({
    ...flatAgentPlan(file, { plugin, contract, artifact, unshaped: "links" }),
    guard: { plugin, name: file.relativePath },
  }));
}

/** An agent in a flat layout, placed, linked and shaped the one way a build and an install share. */
export function flatAgentPlan(
  { relativePath, content }: PluginComponentFile,
  at: {
    plugin: string;
    contract: ToolBuildContract;
    artifact: SupportedArtifact;
    /** What an agent the tool does not reshape goes through: a build rewrites its links, an install carries it. */
    unshaped: "links" | "carry";
  }
): ComponentPlan {
  const { plugin, contract, artifact, unshaped } = at;
  const base = baseOf(relativePath);
  const path = flatAgentPath(artifact, plugin, base);
  const place = {
    plugin,
    outName: base,
    from: path,
    resolveTarget: (rel: string) => flatLinkTarget(contract, plugin, rel),
    unshaped,
  } as const;
  return {
    source: relativePath,
    path,
    content,
    links: agentLinks(artifact, place),
    shape: agentShape(artifact, place),
  };
}

/** How a flat layout reads a skill's links: relative to where the skill lands. */
export function flatSkillLinks(
  contract: ToolBuildContract,
  plugin: string,
  path: string
): ComponentPlan["links"] {
  return relativeLinks(path, (rel) => flatLinkTarget(contract, plugin, rel));
}

function flatSkills(
  canon: PluginDistribution,
  contract: ToolBuildContract,
  artifact: SupportedArtifact
): ComponentPlan[] {
  const plugin = canon.manifest.name;
  return canon.components.skills.map(({ relativePath, content }) => {
    const path = artifactPath(artifact, plugin, relativePath);
    if (!relativePath.endsWith(".md")) return { source: relativePath, path, content };
    return {
      source: relativePath,
      path,
      content,
      guard: { plugin, name: relativePath.slice("skills/".length) },
      links: flatSkillLinks(contract, plugin, path),
      namedAfterFolder: namedByFolder(artifact, relativePath),
    };
  });
}
