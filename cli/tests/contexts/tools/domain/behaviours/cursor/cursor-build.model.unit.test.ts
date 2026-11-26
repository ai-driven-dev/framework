import { describe, expect, it } from "vitest";
import { cursor } from "../../../../../../src/composition/tool-profiles/cursor.js";
import { parseFrontmatter } from "../../../../../../src/shared/domain/markdown.js";
import { builtAgent } from "../../../../../shared/testing/built-agent.builder.js";
import { present } from "../../../../../shared/testing/present.builder.js";

// Built, not written literally: biome reads a string holding "${...}" as a lost template.
const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";

const AGENT_SOURCE = [
  "---",
  "name: planner",
  "description: Plans the work",
  "model: opus",
  "color: blue",
  "---",
  `Read @${ROOT}/skills/01-plan/SKILL.md`,
  `Ask @${ROOT}/agents/reviewer.md`,
  `Run @${ROOT}/hooks/journal.cjs`,
  "",
].join("\n");

describe("building Cursor's marketplace contract", () => {
  it("gives same-named plugin roles distinct native identities", () => {
    const transform = builtAgent(present(cursor.buildContracts.marketplace)(), "marketplace");
    const first = transform?.(AGENT_SOURCE, "first-plugin", "planner.md") ?? "";
    const second = transform?.(AGENT_SOURCE, "second-plugin", "planner.md") ?? "";
    expect(parseFrontmatter(first).frontmatter.name).toBe("first-plugin-planner");
    expect(parseFrontmatter(second).frontmatter.name).toBe("second-plugin-planner");
  });

  it("drops only the file's final .md from a plugin agent's name", () => {
    const transform = builtAgent(present(cursor.buildContracts.marketplace)(), "marketplace");
    const output = transform?.(AGENT_SOURCE, "aidd-dev", "read.md-first.md") ?? "";

    expect(parseFrontmatter(output).frontmatter.name).toBe("aidd-dev-read.md-first");
  });

  it("declares Cursor's own plugin manifest path, schema and root token", () => {
    const contract = present(cursor.buildContracts.marketplace)();

    expect({
      pluginRootToken: contract.pluginRootToken,
      manifestFileRelative: contract.manifestFileRelative,
      manifestSchemaName: contract.manifestSchemaName,
    }).toStrictEqual({
      pluginRootToken: "$" + "{CURSOR_PLUGIN_ROOT}",
      manifestFileRelative: ".cursor-plugin/plugin.json",
      manifestSchemaName: "plugin-manifest",
    });
  });

  it("synthesizes a manifest naming the agents, skills, hooks file and mcp servers a plugin ships", () => {
    const manifest = present(cursor.buildContracts.marketplace)().synthesizeManifest?.(
      { name: "aidd-dev", description: "Development loop", version: "1.2.3" },
      {
        hasAgents: true,
        agentsList: ["planner.md"],
        skillsList: ["01-plan"],
        hasHooksJson: true,
        hasMcpJson: true,
        mcpServers: {},
      }
    );

    expect(manifest).toStrictEqual({
      name: "aidd-dev",
      description: "Development loop",
      version: "1.2.3",
      agents: ["./agents/planner.md"],
      skills: ["./skills/01-plan"],
      hooks: "./hooks/hooks.json",
      mcpServers: "./mcp.json",
    });
  });

  it("keeps an agent's supported frontmatter and links its plugin-root references from agents/", () => {
    const transform = builtAgent(present(cursor.buildContracts.marketplace)(), "marketplace");

    expect(transform?.(AGENT_SOURCE, "aidd-dev", "planner.md")).toBe(
      [
        "---",
        'name: "aidd-dev-planner"',
        'description: "Plans the work"',
        'model: "opus"',
        "---",
        "Read [SKILL.md](../skills/01-plan/SKILL.md)",
        "Ask [reviewer.md](./reviewer.md)",
        "Run [journal.cjs](../hooks/journal.cjs)",
        "",
      ].join("\n")
    );
  });
});
