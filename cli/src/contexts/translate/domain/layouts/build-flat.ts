import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import { artifactPath } from "../../../tools/contract/artifact-path.js";
import type {
  SupportedArtifact,
  ToolBuildContract,
} from "../../../tools/contract/build-contract.js";
import { PLUGIN_HOOKS_RELATIVE } from "../canon-format.js";
import { flatAgentPath, flatLinkTarget, mergeFlatHooks } from "../flat-layout.js";
import { agentLinks } from "../rules/agent-markdown.js";
import { agentShape, type ComponentPlan } from "../rules/component-pipeline.js";
import { flatHookPlans } from "../rules/hook-plans.js";
import { agentFiles, baseOf, isEntry } from "./build-shared.js";

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
      links: {
        kind: "relative",
        currentFilePluginRelative: path,
        resolveTargetPath: (rel) => flatLinkTarget(contract, plugin, rel),
      },
      namedAfterFolder: artifact.rewriteSkillName && isEntry(relativePath) ? true : undefined,
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
  if (file === undefined || file.shared || manifest === undefined) return null;
  const plugin = canon.manifest.name;
  const { content, warnings } = mergeFlatHooks({ file, contract }, null, {
    json: manifest.content,
    plugin,
  });
  return { plan: { source: "", path: file.path(plugin), content }, warnings };
}
