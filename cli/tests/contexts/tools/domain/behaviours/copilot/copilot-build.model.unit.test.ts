import { describe, expect, it } from "vitest";
import { copilot } from "../../../../../../src/composition/tool-profiles/copilot.js";
import { builtAgent } from "../../../../../shared/testing/built-agent.builder.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
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

const _HOOKS_JSON = JSON.stringify({
  hooks: {
    SessionStart: [{ hooks: [{ type: "command", command: "node journal.cjs", timeout: 30 }] }],
  },
});

describe("building Copilot's marketplace contract", () => {
  it("declares Copilot's own plugin manifest path and root token, and validates it against no schema", () => {
    const contract = present(copilot.buildContracts.marketplace)();

    expect({
      pluginRootToken: contract.pluginRootToken,
      manifestFileRelative: contract.manifestFileRelative,
      manifestSchemaName: contract.manifestSchemaName,
    }).toStrictEqual({
      pluginRootToken: "$" + "{PLUGIN_ROOT}",
      manifestFileRelative: ".plugin/plugin.json",
      manifestSchemaName: null,
    });
  });

  it("synthesizes a manifest naming the agents, skills, hooks file and mcp servers a plugin ships", () => {
    const manifest = present(copilot.buildContracts.marketplace)().synthesizeManifest?.(
      { name: "aidd-dev", description: "Development loop", version: "1.2.3" },
      {
        hasAgents: true,
        agentsList: ["planner.md"],
        skillsList: ["01-plan"],
        hasHooksJson: true,
        hooks: {},
        hasMcpJson: true,
        mcpServers: {},
      }
    );

    expect(manifest).toStrictEqual({
      name: "aidd-dev",
      description: "Development loop",
      version: "1.2.3",
      agents: ["./agents/planner.agent.md"],
      skills: ["./skills/01-plan"],
      hooks: "./hooks/hooks.json",
      mcpServers: "./.mcp.json",
    });
  });

  it("keeps what Copilot reads of an agent and links its plugin-root references from agents/", () => {
    const transform = builtAgent(present(copilot.buildContracts.marketplace)(), "marketplace");

    expect(transform?.(AGENT_SOURCE, "aidd-dev", "planner.md")).toBe(
      [
        "---",
        "name: 'planner'",
        "description: 'Plans the work'",
        "model: 'opus'",
        "include-custom-instructions: true",
        "---",
        "Read [SKILL.md](../skills/01-plan/SKILL.md)",
        "Ask [reviewer.md](./reviewer.md)",
        "Run [journal.cjs](../hooks/journal.cjs)",
        "",
      ].join("\n")
    );
  });

  it("builds the OpenPlugin catalog, at .plugin/marketplace.json, with the plugin root beside it", async () => {
    const built = await present(copilot.buildContracts.marketplace)().buildMarketplaceCatalog?.(
      {
        name: "aidd",
        version: "1.0.0",
        description: "AI Driven Dev",
        owner: { name: "AIDD" },
        plugins: [],
      },
      [{ name: "aidd-dev", source: "aidd-dev" }],
      new InMemoryFileAdapter()
    );

    expect(built).toStrictEqual({
      catalog: {
        name: "aidd",
        metadata: {
          description: "AI Driven Dev",
          version: "1.0.0",
          pluginRoot: "./plugins",
        },
        owner: { name: "AIDD" },
        plugins: [{ name: "aidd-dev", source: "aidd-dev" }],
      },
      schemaName: "marketplace",
      destRelPath: ".plugin/marketplace.json",
    });
  });

  it("builds a catalog entry naming the plugin as its own source, from the manifest already written", async () => {
    const fs = new InMemoryFileAdapter({
      "/out/plugins/aidd-dev/.plugin/plugin.json": JSON.stringify({
        version: "1.2.3",
        description: "Development loop",
      }),
    });

    const entry = await present(copilot.buildContracts.marketplace)().buildMarketplaceEntry?.({
      name: "aidd-dev",
      pluginSrc: "/src/plugins/aidd-dev",
      outDir: "/out",
      srcEntry: undefined,
      fs,
    });

    expect(entry).toStrictEqual({
      name: "aidd-dev",
      source: "aidd-dev",
      description: "Development loop",
      version: "1.2.3",
    });
  });
});
