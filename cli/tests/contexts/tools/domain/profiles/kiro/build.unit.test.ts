import { describe, expect, it } from "vitest";
import type { ArtifactContract } from "../../../../../../src/contexts/tools/domain/build-contract.js";
import { buildKiroFlatContract } from "../../../../../../src/contexts/tools/domain/profiles/kiro/build.js";

function supported(artifact: ArtifactContract): Extract<ArtifactContract, { supported: true }> {
  if (!artifact.supported) throw new Error("artifact is declared unsupported");
  return artifact;
}

describe("buildKiroFlatContract", () => {
  it("places skills one level below .kiro/skills, where Kiro lists them", () => {
    const skills = supported(buildKiroFlatContract().artifacts.skills);
    expect(skills.path("aidd-dev", "skills/01-plan/SKILL.md")).toBe(
      ".kiro/skills/aidd-dev-01-plan/SKILL.md"
    );
    expect(skills.path("aidd-dev", "skills/01-plan/actions/01-gather.md")).toBe(
      ".kiro/skills/aidd-dev-01-plan/actions/01-gather.md"
    );
    expect(skills.rewriteSkillName).toBe(true);
  });

  it("writes each agent as a JSON profile under .kiro/agents", () => {
    const agents = supported(buildKiroFlatContract().artifacts.agents);
    expect(agents.path("aidd-dev", "agents/checker.md")).toBe(".kiro/agents/aidd-dev-checker.json");
  });

  it("gives an agent only CLI V3 profile fields, its body as the prompt", () => {
    const agents = supported(buildKiroFlatContract().artifacts.agents);
    const source =
      "---\nname: checker\ndescription: Judges finished work\ntools: Read, Grep\n---\n\n# Role\n\nYou judge.\n";

    const profile = JSON.parse(agents.transform?.(source, "aidd-dev", "checker.md") ?? "null");

    expect(profile).toEqual({
      name: "aidd-dev-checker",
      description: "Judges finished work",
      prompt: "# Role\n\nYou judge.",
      tools: ["*"],
    });
  });

  it("merges every plugin's hooks into one file of Kiro's own shape, each plugin's scripts beside it", () => {
    const hooks = supported(buildKiroFlatContract().artifacts.hooks);
    expect(hooks.hooksFile?.path("aidd-context")).toBe(".kiro/hooks/aidd.json");
    expect(hooks.hooksFile?.shared).toBe(true);
    expect(hooks.path("aidd-context", "hooks/lib/host.cjs")).toBe(
      ".kiro/hooks/aidd-context/lib/host.cjs"
    );

    const merged = hooks.hooksFile?.merge(
      null,
      JSON.stringify({
        hooks: {
          SessionStart: [{ hooks: [{ command: "node $" + "{CLAUDE_PLUGIN_ROOT}/hooks/a.cjs" }] }],
          Stop: [{ hooks: [{ command: "node $" + "{CLAUDE_PLUGIN_ROOT}/hooks/a.cjs" }] }],
        },
      }),
      "aidd-context",
      (pluginPath) => pluginPath
    );
    expect(JSON.parse(merged?.content ?? "null")).toMatchObject({
      version: "v1",
      hooks: [{ name: "aidd-context-a.cjs", trigger: "SessionStart" }],
    });
    expect(merged?.warnings).toEqual(["kiro: unmapped event 'Stop' skipped"]);
  });

  it("puts Kiro's own host adapter where a plugin ships Claude Code's", () => {
    const hooks = supported(buildKiroFlatContract().artifacts.hooks);
    expect(hooks.script?.("hooks/lib/host.cjs", "shipped")).toContain('const HOST = "kiro";');
    expect(hooks.script?.("hooks/memory.cjs", "shipped")).toBe("shipped");
  });

  it("merges MCP servers into .kiro/settings/mcp.json under mcpServers, keeping existing ones", () => {
    const mcp = supported(buildKiroFlatContract().artifacts.mcp);
    expect(mcp.path("aidd-dev", ".mcp.json")).toBe(".kiro/settings/mcp.json");
    expect(mcp.mergeDest?.("/out")).toBe("/out/.kiro/settings/mcp.json");
    expect(mcp.mcpServersKey).toBe("mcpServers");

    const existing = JSON.stringify({ mcpServers: { mine: { command: "mine" } } });
    const merged = mcp.merge?.(existing, { "aidd-dev-context": { command: "node" } }, false);

    expect(JSON.parse(merged?.mergedContent ?? "null")).toEqual({
      mcpServers: { mine: { command: "mine" }, "aidd-dev-context": { command: "node" } },
    });
  });

  it("gives an agent without a description an empty one, as Kiro requires a string", () => {
    const agents = supported(buildKiroFlatContract().artifacts.agents);
    const profile = JSON.parse(
      agents.transform?.("---\nname: x\n---\nBody\n", "aidd-dev", "x.md") ?? "null"
    );
    expect(profile.description).toBe("");
  });

  it("reads each artifact from where a plugin keeps it", () => {
    const { artifacts } = buildKiroFlatContract();
    expect(supported(artifacts.skills).source).toEqual({ kind: "fullTree", srcDir: "skills" });
    expect(supported(artifacts.agents).source).toEqual({
      kind: "filteredTree",
      srcDir: "agents",
      inputExt: ".md",
    });
    expect(supported(artifacts.mcp).source).toEqual({ kind: "configFile", srcPath: ".mcp.json" });
  });

  it("delivers no rules and no commands", () => {
    const { artifacts } = buildKiroFlatContract();
    expect(artifacts.rules.supported).toBe(false);
    expect(artifacts.commands.supported).toBe(false);
  });
});
