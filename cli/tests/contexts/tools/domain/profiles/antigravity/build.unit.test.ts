import { describe, expect, it } from "vitest";
import { buildAntigravityFlatContract } from "../../../../../../src/contexts/tools/domain/profiles/antigravity/build.js";
import { supported } from "../../../testing/build-artifacts.js";

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
    expect([hooks.hooksFile?.path("aidd-context"), hooks.hooksFile?.shared]).toEqual([
      ".agents/hooks.json",
      true,
    ]);
    expect(
      JSON.parse(
        hooks.hooksFile?.merge(null, incoming, "aidd-context", (path) => path).content ?? ""
      )
    ).toEqual({
      "aidd-context": {
        SessionStart: [
          {
            type: "command",
            command: expect.stringContaining(
              Buffer.from("node ./.agents/hooks/aidd-context/update_memory.js").toString("base64")
            ),
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

  it("places a path outside skills/ and agents/ by the skills rule only for a skills/ prefix", () => {
    const { path } = supported(buildAntigravityFlatContract().artifacts.skills);

    expect(path("aidd-dev", "docs/skills/01-plan/SKILL.md")).toBe(
      ".agents/skills/aidd-dev-docs/skills/01-plan/SKILL.md"
    );
  });

  it("names an agent by stripping only a trailing .md or .agent.md and a leading agents/", () => {
    const { path } = supported(buildAntigravityFlatContract().artifacts.agents);

    expect(path("aidd-dev", "agents/a.md.agent.md")).toBe(".agents/agents/aidd-dev-a.md/agent.md");
    expect(path("aidd-dev", "docs/agents/a.md")).toBe(
      ".agents/agents/aidd-dev-docs/agents/a/agent.md"
    );
  });

  it("reads agents from agents/ as .md files only", () => {
    const { source } = supported(buildAntigravityFlatContract().artifacts.agents);

    expect(source).toEqual({ kind: "filteredTree", srcDir: "agents", inputExt: ".md" });
  });

  it("links an agent's body to another agent, to a skill and to a file in neither", () => {
    const { transform } = supported(buildAntigravityFlatContract().artifacts.agents);
    const source = [
      "---",
      "name: executor",
      "description: Turns a task into code.",
      "---",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the Claude placeholder the rewrite resolves
      "@${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md and @${CLAUDE_PLUGIN_ROOT}/rules/style.md",
    ].join("\n");

    expect(transform?.(source, "aidd-dev", "executor.md")).toContain(
      "[reviewer.md](../aidd-dev-reviewer/agent.md) and [style.md](../../../rules/style.md)"
    );
  });

  it("prefixes a hooks warning with antigravity", () => {
    const { hooksFile } = supported(buildAntigravityFlatContract().artifacts.hooks);
    const incoming = JSON.stringify({
      hooks: { Stop: [{ hooks: [{ type: "command", command: "node x.cjs" }] }] },
    });

    expect(hooksFile?.merge(null, incoming, "aidd-dev", (path) => path).warnings).toEqual([
      "antigravity: unmapped event 'Stop' skipped",
    ]);
  });

  it.each(["mcp", "rules", "commands"] as const)("declares %s unsupported", (kind) => {
    expect(buildAntigravityFlatContract().artifacts[kind].supported).toBe(false);
  });

  it("writes no manifest, catalog or config artifact", () => {
    const contract = buildAntigravityFlatContract();
    expect(contract.manifestFileRelative).toBeNull();
    expect(contract.buildMarketplaceCatalog).toBeNull();
    expect(contract.configArtifact).toBeUndefined();
  });
});
