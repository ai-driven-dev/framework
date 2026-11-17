import { describe, expect, it } from "vitest";
import type { ArtifactContract } from "../../../../../../src/contexts/tools/domain/build-contract.js";
import { buildKimiFlatContract } from "../../../../../../src/contexts/tools/domain/profiles/kimi/build.js";
import { InvalidAgentFrontmatterError } from "../../../../../../src/kernel/errors.js";

function supported(artifact: ArtifactContract): Extract<ArtifactContract, { supported: true }> {
  if (!artifact.supported) throw new Error("artifact is declared unsupported");
  return artifact;
}

describe("buildKimiFlatContract", () => {
  it("sits a skill one level under .kimi-code/skills, the plugin hyphenated onto its name", () => {
    const skills = supported(buildKimiFlatContract().artifacts.skills);
    expect(skills.path("aidd-dev", "skills/01-plan/SKILL.md")).toBe(
      ".kimi-code/skills/aidd-dev-01-plan/SKILL.md"
    );
    expect(skills.path("aidd-dev", "skills/01-plan/references/a.md")).toBe(
      ".kimi-code/skills/aidd-dev-01-plan/references/a.md"
    );
    expect(skills.rewriteSkillName).toBe(true);
    expect(skills.source).toEqual({ kind: "fullTree", srcDir: "skills" });
  });

  it.each([
    ["agents/executor.md", ".kimi-code/agents/aidd-dev-executor.md"],
    ["agents/executor.agent.md", ".kimi-code/agents/aidd-dev-executor.md"],
    ["agents/review/reviewer.md", ".kimi-code/agents/aidd-dev-review-reviewer.md"],
  ])("writes the agent %s as one file named after its plugin", (rel, expected) => {
    expect(supported(buildKimiFlatContract().artifacts.agents).path("aidd-dev", rel)).toBe(
      expected
    );
  });

  it("reads every Markdown agent under the plugin's agents/", () => {
    expect(supported(buildKimiFlatContract().artifacts.agents).source).toEqual({
      kind: "filteredTree",
      srcDir: "agents",
      inputExt: ".md",
    });
  });

  it("links another agent at the file the agents build writes, and a plugin file where it is", () => {
    const agents = supported(buildKimiFlatContract().artifacts.agents);
    const source = [
      "---",
      "description: Plans.",
      "---",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the Claude placeholder the rewrite resolves
      "Hand off to @${CLAUDE_PLUGIN_ROOT}/agents/executor.md",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the Claude placeholder the rewrite resolves
      "Read @${CLAUDE_PLUGIN_ROOT}/README.md",
    ].join("\n");
    const out = agents.transform?.(source, "aidd-dev", "planner.md");

    expect(out).toContain("Hand off to [executor.md](./aidd-dev-executor.md)");
    expect(out).toContain("Read [README.md](../../README.md)");
  });

  it("rebuilds the agent's frontmatter and links its body from .kimi-code/agents", () => {
    const agents = supported(buildKimiFlatContract().artifacts.agents);
    const source = [
      "---",
      "name: executor",
      "description: Turns a task into code.",
      "model: opus",
      "tools: Read, Grep",
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
        "tools:",
        "  - Read",
        "  - Grep",
        "---",
        "Follow [SKILL.md](../skills/aidd-dev-01-plan/SKILL.md)",
      ].join("\n")
    );
  });

  it.each([
    ["a name Kimi would skip", "Executor.md", "description: Turns a task into code."],
    ["a description Kimi requires", "executor.md", "description: ''"],
  ])("stops the build on %s instead of letting Kimi drop the agent", (_, outName, line) => {
    const agents = supported(buildKimiFlatContract().artifacts.agents);
    const source = ["---", line, "---", "Body"].join("\n");

    expect(() => agents.transform?.(source, "aidd-dev", outName)).toThrow(
      InvalidAgentFrontmatterError
    );
  });

  it("names the agent and the rule it breaks", () => {
    const agents = supported(buildKimiFlatContract().artifacts.agents);
    const source = ["---", "description: Plans.", "---", "Body"].join("\n");

    expect(() => agents.transform?.(source, "aidd-dev", "Planner.md")).toThrow(
      "Agent 'aidd-dev-Planner' has invalid frontmatter: name is not kebab-case."
    );
  });

  it.each(["hooks", "mcp", "rules", "commands"] as const)("declares %s unsupported", (kind) => {
    expect(buildKimiFlatContract().artifacts[kind].supported).toBe(false);
  });

  it("writes no manifest, catalog or config artifact", () => {
    const contract = buildKimiFlatContract();
    expect(contract.manifestFileRelative).toBeNull();
    expect(contract.buildMarketplaceCatalog).toBeNull();
    expect(contract.configArtifact).toBeUndefined();
  });
});
