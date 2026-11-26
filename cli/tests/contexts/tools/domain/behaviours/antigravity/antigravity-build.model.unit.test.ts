import { describe, expect, it } from "vitest";
import { antigravity } from "../../../../../../src/composition/tool-profiles/antigravity.js";
import { artifactPath } from "../../../../../../src/shared/domain/materialization/artifact-path.js";
import { builtAgent } from "../../../../../shared/testing/built-agent.builder.js";
import { present } from "../../../../../shared/testing/present.builder.js";
import { supported } from "../../../testing/build-artifacts.builder.js";

describe("building Antigravity's flat contract", () => {
  it("sits a skill one level under .agents/skills, the plugin hyphenated onto its name", () => {
    const skills = supported(present(antigravity.buildContracts.flat)().artifacts.skills);
    expect(artifactPath(skills, "aidd-dev", "skills/01-plan/SKILL.md")).toBe(
      ".agents/skills/aidd-dev-01-plan/SKILL.md"
    );
    expect(skills.rewriteSkillName).toBe(true);
    expect(skills.source).toEqual({ kind: "fullTree", srcDir: "skills" });
  });

  it("copies hook scripts under .agents/hooks/<plugin>/ and merges their commands into .agents/hooks.json", () => {
    const hooks = supported(present(antigravity.buildContracts.flat)().artifacts.hooks);
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

    expect(artifactPath(hooks, "aidd-context", "hooks/update_memory.js")).toBe(
      ".agents/hooks/aidd-context/update_memory.js"
    );
    expect(hooks.hooksFile?.at).toEqual({ shared: ".agents/hooks.json" });
    expect(
      JSON.parse(
        hooks.hooksFile?.merge(null, {
          json: incoming,
          plugin: "aidd-context",
          locate: (path) => path,
        }).content ?? ""
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
    const agents = supported(present(antigravity.buildContracts.flat)().artifacts.agents);

    expect(artifactPath(agents, "aidd-dev", "agents/executor.md")).toBe(
      ".agents/agents/aidd-dev-executor/agent.md"
    );
    expect(artifactPath(agents, "aidd-dev", "agents/executor.agent.md")).toBe(
      ".agents/agents/aidd-dev-executor/agent.md"
    );
  });

  it("rebuilds the agent's frontmatter and links its body from the nested directory", () => {
    const transform = builtAgent(present(antigravity.buildContracts.flat)(), "flat");
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

    expect(transform(source, "aidd-dev", "executor.md")).toBe(
      [
        "---",
        "name: 'aidd-dev-executor'",
        "description: 'Turns a task into code.'",
        "model: 'inherit'",
        'tools: ["view_file","grep_search","replace_file_content","write_file","run_command"]',
        "---",
        "Follow [SKILL.md](../../skills/aidd-dev-01-plan/SKILL.md)",
      ].join("\n")
    );
  });

  it.each([
    ["Read, Bash, Task, Read", '["view_file","run_command"]'],
    ["Write, Edit, Grep", '["write_file","replace_file_content","grep_search"]'],
    ["Task, Glob", "[]"],
  ])("grants an agent declaring `%s` only the agy tools it maps to: %s", (declared, expected) => {
    const transform = builtAgent(present(antigravity.buildContracts.flat)(), "flat");
    const source = `---\nname: executor\ndescription: d\ntools: ${declared}\n---\nbody`;

    expect(transform(source, "aidd-dev", "executor.md")).toContain(`\ntools: ${expected}\n`);
  });

  it("places a path outside skills/ and agents/ by the skills rule only for a skills/ prefix", () => {
    const skills = supported(present(antigravity.buildContracts.flat)().artifacts.skills);

    expect(artifactPath(skills, "aidd-dev", "docs/skills/01-plan/SKILL.md")).toBe(
      ".agents/skills/aidd-dev-docs/skills/01-plan/SKILL.md"
    );
  });

  it("names an agent by stripping only a trailing .md or .agent.md and a leading agents/", () => {
    const agents = supported(present(antigravity.buildContracts.flat)().artifacts.agents);

    expect(artifactPath(agents, "aidd-dev", "agents/a.md.agent.md")).toBe(
      ".agents/agents/aidd-dev-a.md/agent.md"
    );
    expect(artifactPath(agents, "aidd-dev", "docs/agents/a.md")).toBe(
      ".agents/agents/aidd-dev-docs/agents/a/agent.md"
    );
  });

  it("reads agents from agents/ as .md files only", () => {
    const { source } = supported(present(antigravity.buildContracts.flat)().artifacts.agents);

    expect(source).toEqual({ kind: "filteredTree", srcDir: "agents", inputExt: ".md" });
  });

  it("links an agent's body to another agent, to a skill and to a file in neither", () => {
    const transform = builtAgent(present(antigravity.buildContracts.flat)(), "flat");
    const source = [
      "---",
      "name: executor",
      "description: Turns a task into code.",
      "---",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the Claude placeholder the rewrite resolves
      "@${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md and @${CLAUDE_PLUGIN_ROOT}/rules/style.md",
    ].join("\n");

    expect(transform(source, "aidd-dev", "executor.md")).toContain(
      "[reviewer.md](../aidd-dev-reviewer/agent.md) and [style.md](../../../rules/style.md)"
    );
  });

  it("prefixes a hooks warning with antigravity", () => {
    const { hooksFile } = supported(present(antigravity.buildContracts.flat)().artifacts.hooks);
    const incoming = JSON.stringify({
      hooks: { SessionEnd: [{ hooks: [{ type: "command", command: "node x.cjs" }] }] },
    });

    expect(
      hooksFile?.merge(null, { json: incoming, plugin: "aidd-dev", locate: (path) => path })
        .warnings
    ).toEqual(["antigravity: unmapped event 'SessionEnd' skipped"]);
  });

  it("folds every plugin's MCP servers into the one file agy reads for the project", () => {
    const mcp = supported(present(antigravity.buildContracts.flat)().artifacts.mcp);

    expect([artifactPath(mcp, "aidd-dev", ".mcp.json"), mcp.mcpServersKey]).toEqual([
      ".agents/mcp_config.json",
      "mcpServers",
    ]);
  });

  it("writes no manifest, catalog or config artifact", () => {
    const contract = present(antigravity.buildContracts.flat)();
    expect(contract.manifestFileRelative).toBeNull();
    expect(contract.buildMarketplaceCatalog).toBeNull();
    expect(contract.configArtifact).toBeUndefined();
  });
});

// biome-ignore lint/suspicious/noTemplateCurlyInString: the Claude placeholder a plugin writes
const PLUGIN_ROOT_VAR = "${CLAUDE_PLUGIN_ROOT}";

describe("building Antigravity's plugin tree contract", () => {
  const tree = () => present(antigravity.buildContracts.marketplace)();

  it("keeps a plugin's manifest at plugin.json and its MCP servers at mcp_config.json", () => {
    const { artifacts, manifestFileRelative } = tree();
    const mcp = supported(artifacts.mcp);

    expect([manifestFileRelative, artifactPath(mcp, "aidd-dev", ".mcp.json")]).toEqual([
      "plugin.json",
      "mcp_config.json",
    ]);
  });

  it("keeps skills where the plugin ships them, below the plugin's directory", () => {
    const skills = supported(tree().artifacts.skills);

    expect(artifactPath(skills, "aidd-dev", "skills/01-plan/SKILL.md")).toBe(
      "skills/01-plan/SKILL.md"
    );
  });

  it("writes a plugin's hooks as the named group agy reads at the plugin's root, run from its directory", () => {
    const hooks = supported(tree().artifacts.hooks);
    const incoming = JSON.stringify({
      hooks: {
        SessionStart: [
          {
            hooks: [{ type: "command", command: `node ${PLUGIN_ROOT_VAR}/hooks/run.cjs load` }],
          },
        ],
      },
    });
    const [handler] = JSON.parse(hooks.transform?.(incoming, "aidd-context", "hooks.json") ?? "")[
      "aidd-context"
    ].SessionStart;

    expect([artifactPath(hooks, "aidd-context", "hooks/hooks.json"), handler.command]).toEqual([
      "hooks.json",
      expect.stringContaining(
        Buffer.from("node ./.agents/plugins/aidd-context/hooks/run.cjs load").toString("base64")
      ),
    ]);
    expect(handler.command).toContain("cwd:'../../..'");
  });

  it("reports an event agy never fires, under the tool, instead of dropping it silently", () => {
    const hooks = supported(tree().artifacts.hooks);
    const incoming = JSON.stringify({
      hooks: { SessionEnd: [{ hooks: [{ type: "command", command: "node end.cjs" }] }] },
    });

    expect(hooks.convertHooks?.(incoming, "aidd-context").warnings).toEqual([
      "antigravity: unmapped event 'SessionEnd' skipped",
    ]);
  });
});
