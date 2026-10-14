import { describe, expect, it } from "vitest";
import type { ArtifactContract } from "../../../../../../src/contexts/tools/domain/build-contract.js";
import { buildAntigravityFlatContract } from "../../../../../../src/contexts/tools/domain/profiles/antigravity/build.js";

function supported(artifact: ArtifactContract): Extract<ArtifactContract, { supported: true }> {
  if (!artifact.supported) throw new Error("artifact is declared unsupported");
  return artifact;
}

describe("buildAntigravityFlatContract", () => {
  it("sits a skill one level under .agents/skills, the plugin hyphenated onto its name", () => {
    const skills = supported(buildAntigravityFlatContract().artifacts.skills);
    expect(skills.path("aidd-dev", "skills/01-plan/SKILL.md")).toBe(
      ".agents/skills/aidd-dev-01-plan/SKILL.md"
    );
    expect(skills.rewriteSkillName).toBe(true);
    expect(skills.source).toEqual({ kind: "fullTree", srcDir: "skills" });
  });

  it("copies hook scripts under .agents/hooks/<plugin>/ and merges their commands into .agents/hooks.json", () => {
    const hooks = supported(buildAntigravityFlatContract().artifacts.hooks);
    const incoming = JSON.stringify({
      hooks: {
        SessionStart: [
          {
            hooks: [
              { type: "command", command: "node ./.agents/hooks/aidd-context/update_memory.js" },
            ],
          },
        ],
      },
    });

    expect(hooks.path("aidd-context", "hooks/update_memory.js")).toBe(
      ".agents/hooks/aidd-context/update_memory.js"
    );
    expect(hooks.hooksMergeDest?.("/out")).toBe("/out/.agents/hooks.json");
    expect(JSON.parse(hooks.hooksMerge?.(null, incoming, "aidd-context").content ?? "")).toEqual({
      "aidd-context": {
        SessionStart: [
          {
            type: "command",
            command: "cd .. && node ./.agents/hooks/aidd-context/update_memory.js",
          },
        ],
      },
    });
  });

  it("writes an agent only in the nested layout, named after its plugin", () => {
    const agents = supported(buildAntigravityFlatContract().artifacts.agents);

    expect(agents.path("aidd-dev", "agents/executor.md")).toBe(
      ".agents/agents/aidd-dev-executor/agent.md"
    );
    expect(agents.path("aidd-dev", "agents/executor.agent.md")).toBe(
      ".agents/agents/aidd-dev-executor/agent.md"
    );
  });

  it("rebuilds the agent's frontmatter and links its body from the nested directory", () => {
    const agents = supported(buildAntigravityFlatContract().artifacts.agents);
    const source = [
      "---",
      "name: executor",
      "description: Turns a task into code.",
      "model: opus",
      "color: red",
      "---",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the Claude placeholder the rewrite resolves
      "Follow @${CLAUDE_PLUGIN_ROOT}/skills/01-plan/SKILL.md",
    ].join("\n");

    expect(agents.transform?.(source, "aidd-dev", "executor.md")).toBe(
      [
        "---",
        "name: 'aidd-dev-executor'",
        "description: 'Turns a task into code.'",
        "model: 'inherit'",
        "---",
        "Follow [SKILL.md](../../skills/aidd-dev-01-plan/SKILL.md)",
      ].join("\n")
    );
  });

  it.each(["mcp", "rules", "commands"] as const)("declares %s unsupported", (kind) => {
    expect(buildAntigravityFlatContract().artifacts[kind].supported).toBe(false);
  });

  it("writes no manifest, catalog or config artifact", () => {
    const contract = buildAntigravityFlatContract();
    expect(contract.manifestFileRelative).toBeNull();
    expect(contract.buildMarketplaceCatalog).toBeNull();
    expect(contract.emitConfigArtifact).toBeUndefined();
  });
});
