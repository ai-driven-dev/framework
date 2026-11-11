import type {
  ArtifactContract,
  ArtifactSource,
  ToolBuildContract,
} from "../../../../src/contexts/tools/domain/build-contract.js";

type Artifacts = ToolBuildContract["artifacts"];

export function supported(
  artifact: ArtifactContract
): Extract<ArtifactContract, { supported: true }> {
  if (!artifact.supported) throw new Error("artifact is declared unsupported");
  return artifact;
}

export function sourceOf(artifact: ArtifactContract): ArtifactSource | null {
  return artifact.supported ? artifact.source : null;
}

/** What a host that installs a plugin tree as it ships reads from that tree. */
export const PLUGIN_TREE_SOURCES = {
  skills: { kind: "fullTree", srcDir: "skills" },
  agents: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
  mcp: { kind: "configFile", srcPath: ".mcp.json" },
  hooks: { kind: "hooksBundle", jsonPath: "hooks/hooks.json", scriptDir: "hooks" },
  rules: { supported: false },
  commands: { supported: false },
};

export function pluginTreeSourcesOf(artifacts: Artifacts) {
  return {
    skills: sourceOf(artifacts.skills),
    agents: sourceOf(artifacts.agents),
    mcp: sourceOf(artifacts.mcp),
    hooks: sourceOf(artifacts.hooks),
    rules: artifacts.rules,
    commands: artifacts.commands,
  };
}

/** What a host that keeps every artifact where the plugin tree had it installs. */
export const PLUGIN_RELATIVE_PATHS = {
  skill: "skills/01-plan/SKILL.md",
  agent: "agents/planner.md",
  mcp: ".mcp.json",
  hook: "hooks/journal.cjs",
};

export function pluginRelativePathsOf(artifacts: Artifacts) {
  return {
    skill: supported(artifacts.skills).path("aidd-dev", "skills/01-plan/SKILL.md"),
    agent: supported(artifacts.agents).path("aidd-dev", "agents/planner.md"),
    mcp: supported(artifacts.mcp).path("aidd-dev", ".mcp.json"),
    hook: supported(artifacts.hooks).path("aidd-dev", "hooks/journal.cjs"),
  };
}
