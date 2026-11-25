import {
  artifactPath,
  hooksFilePath,
} from "../../../../shared/domain/materialization/artifact-path.js";
import type {
  SupportedArtifact,
  ToolBuildContract,
} from "../../../../shared/domain/materialization/build-contract.js";
import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import { PLUGIN_HOOKS_RELATIVE } from "../canon-format.js";
import {
  flatAgentPath,
  flatCommandFolders,
  flatLinkTarget,
  mergeFlatHooks,
} from "../flat-layout.js";
import { agentLinks } from "../rules/agent-markdown.js";
import { agentShape, type ComponentPlan } from "../rules/component-pipeline.js";
import { foldsFlatMcp } from "../rules/flat-mcp.js";
import { flatHookPlans } from "../rules/hook-plans.js";
import { relativeLinks } from "../rules/links.js";
import { flatRules } from "./build-flat-rules.js";
import { agentFiles, baseOf, namedByFolder } from "./build-shared.js";

/** A flat build's plugin files, in the tool's own folders. Its MCP servers and hooks file are
 * merged across plugins by the sink. */
export function buildFlatPlans(
  canon: PluginDistribution,
  contract: ToolBuildContract
): ComponentPlan[] {
  const { agents, hooks, rules, skills } = contract.artifacts;
  return [
    ...flatCommandFiles(canon, contract),
    ...(agents.supported ? flatAgents(canon, contract, agents) : []),
    ...(hooks.supported ? flatHooks(canon, hooks) : []),
    ...(skills.supported ? flatSkills(canon, contract, skills) : []),
    ...(rules?.supported ? flatRules(canon, rules) : []),
  ];
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

function flatHooks(canon: PluginDistribution, artifact: SupportedArtifact): ComponentPlan[] {
  const plugin = canon.manifest.name;
  return flatHookPlans(canon, {
    place: (relativePath) => artifactPath(artifact, plugin, relativePath),
    script: (relativePath, content) => artifact.script?.(relativePath, content) ?? content,
    bridge: artifact.skipHooksJson ? (artifact.hooksBridge ?? null) : null,
    bridgeFirst: true,
    needsManifest: true,
  });
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

/** The hooks file a plugin owns whole, for a tool that gives each plugin one: its manifest, merged
 * into nothing. A tool whose hooks file every plugin shares has none, and the sink folds it. */
export function flatOwnHooksFile(
  canon: PluginDistribution,
  contract: ToolBuildContract
): { plan: ComponentPlan; warnings: readonly string[] } | null {
  const { hooks } = contract.artifacts;
  const file = hooks.supported && !hooks.skipHooksJson ? hooks.hooksFile : undefined;
  const manifest = canon.components.hooks.find((f) => f.relativePath === PLUGIN_HOOKS_RELATIVE);
  if (file === undefined || "shared" in file.at || manifest === undefined) return null;
  const plugin = canon.manifest.name;
  const { content, warnings } = mergeFlatHooks({ file, contract }, null, {
    json: manifest.content,
    plugin,
  });
  return { plan: { source: "", path: hooksFilePath(file, plugin), content }, warnings };
}
