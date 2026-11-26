import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/composition/tool-profiles/claude.js";
import { builtAgent } from "../../../../../shared/testing/built-agent.builder.js";
import { present } from "../../../../../shared/testing/present.builder.js";

// Built, not written literally: biome reads a string holding "${...}" as a lost template.
const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";

const AGENT_SOURCE = [
  "---",
  "name: planner",
  "description: Plans the work",
  "model: opus",
  "tools: [Read]",
  "color: red",
  "---",
  `Read @${ROOT}/skills/01-plan/SKILL.md`,
  `Ask @${ROOT}/agents/reviewer.md`,
  `Run @${ROOT}/hooks/journal.cjs`,
  "",
].join("\n");

const _HOOKS_JSON = JSON.stringify({
  hooks: { Stop: [{ hooks: [{ type: "command", command: "node journal.cjs" }] }] },
});

describe("building Claude's marketplace contract", () => {
  it("declares Claude's own plugin manifest path, schema and root token", () => {
    const contract = present(claude.buildContracts.marketplace)();

    expect({
      pluginRootToken: contract.pluginRootToken,
      manifestFileRelative: contract.manifestFileRelative,
      manifestSchemaName: contract.manifestSchemaName,
    }).toStrictEqual({
      pluginRootToken: ROOT,
      manifestFileRelative: ".claude-plugin/plugin.json",
      manifestSchemaName: "plugin-manifest",
    });
  });

  it("synthesizes a manifest naming the agents and skills, and never the hooks file Claude finds itself", () => {
    const manifest = present(claude.buildContracts.marketplace)().synthesizeManifest?.(
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
      mcpServers: "./.mcp.json",
    });
  });

  it("keeps only the frontmatter Claude reads, so an agent gets every tool, and links its plugin-root references from agents/", () => {
    const transform = builtAgent(present(claude.buildContracts.marketplace)(), "marketplace");

    expect(transform?.(AGENT_SOURCE, "aidd-dev", "planner.md")).toBe(
      [
        "---",
        "name: 'planner'",
        "description: 'Plans the work'",
        "model: 'opus'",
        "---",
        "Read [SKILL.md](../skills/01-plan/SKILL.md)",
        "Ask [reviewer.md](./reviewer.md)",
        "Run [journal.cjs](../hooks/journal.cjs)",
        "",
      ].join("\n")
    );
  });
});
