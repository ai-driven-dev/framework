import { describe, expect, it } from "vitest";
import {
  buildClaudeContract,
  buildClaudeFlatContract,
} from "../../../../../../src/contexts/tools/domain/profiles/claude/build.js";
import { supported } from "../../../testing/build-artifacts.js";

// Built, not written literally: biome reads a string holding "${...}" as a lost template.
const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";

const AGENT_SOURCE = [
  "---",
  "name: planner",
  "description: Plans the work",
  "model: opus",
  "---",
  `Read @${ROOT}/skills/01-plan/SKILL.md`,
  `Ask @${ROOT}/agents/reviewer.md`,
  `Run @${ROOT}/hooks/journal.cjs`,
  "",
].join("\n");

const HOOKS_JSON = JSON.stringify({
  hooks: { Stop: [{ hooks: [{ type: "command", command: "node journal.cjs" }] }] },
});

describe("buildClaudeContract()", () => {
  it("declares Claude's own plugin manifest path, schema and root token", () => {
    const contract = buildClaudeContract();

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
    const manifest = buildClaudeContract().synthesizeManifest?.(
      { name: "aidd-dev", description: "Development loop", version: "1.2.3" },
      {
        hasAgents: true,
        agentsList: ["planner.md"],
        skillsList: ["01-plan"],
        hasHooksJson: true,
        hasMcpJson: true,
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

  it("keeps an agent's whole frontmatter and links its plugin-root references from agents/", () => {
    const transform = supported(buildClaudeContract().artifacts.agents).transform;

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

describe("buildClaudeFlatContract()", () => {
  it("lands a plugin's hooks declaration beside Claude's hooks and its scripts under the plugin's own folder", () => {
    const hooks = supported(buildClaudeFlatContract().artifacts.hooks);

    expect({
      declaration: hooks.path("aidd-dev", "hooks/aidd-dev.hooks.json"),
      script: hooks.path("aidd-dev", "hooks/journal.cjs"),
      file: [hooks.hooksFile?.path("aidd-dev"), hooks.hooksFile?.shared],
    }).toStrictEqual({
      declaration: ".claude/hooks/aidd-dev.hooks.json",
      script: ".claude/hooks/aidd-dev/journal.cjs",
      file: [".claude/settings.json", true],
    });
  });

  it("appends a plugin's hooks to the settings file, leaving every other setting alone", () => {
    const hooks = supported(buildClaudeFlatContract().artifacts.hooks);

    expect(
      hooks.hooksFile?.merge(
        JSON.stringify({ model: "opus" }),
        HOOKS_JSON,
        "aidd-dev",
        (path) => path
      )
    ).toStrictEqual({
      content: `${JSON.stringify(
        {
          model: "opus",
          hooks: { Stop: [{ hooks: [{ type: "command", command: "node journal.cjs" }] }] },
        },
        null,
        2
      )}\n`,
      warnings: [],
    });
  });

  it("adds a plugin's mcp servers to the workspace .mcp.json under mcpServers", () => {
    const mcp = supported(buildClaudeFlatContract().artifacts.mcp);

    expect({
      path: mcp.path("aidd-dev", ".mcp.json"),
      mcpServersKey: mcp.mcpServersKey,
      mergeDest: mcp.mergeDest?.("/out"),
      merged: mcp.merge?.(null, { "aidd-dev-context": { command: "node" } }, false),
    }).toStrictEqual({
      path: ".mcp.json",
      mcpServersKey: "mcpServers",
      mergeDest: "/out/.mcp.json",
      merged: {
        mergedContent:
          '{\n  "mcpServers": {\n    "aidd-dev-context": {\n      "command": "node"\n    }\n  }\n}\n',
        collisions: [],
      },
    });
  });

  it("renames a flat agent after its plugin and points its references at their flat destinations", () => {
    const transform = supported(buildClaudeFlatContract().artifacts.agents).transform;

    expect(transform?.(AGENT_SOURCE, "aidd-dev", "planner.md")).toBe(
      [
        "---",
        "name: 'aidd-dev-planner'",
        "description: 'Plans the work'",
        "model: 'opus'",
        "---",
        "Read [SKILL.md](../skills/aidd-dev-01-plan/SKILL.md)",
        "Ask [reviewer.md](./aidd-dev-reviewer.md)",
        "Run [journal.cjs](../../hooks/journal.cjs)",
        "",
      ].join("\n")
    );
  });
});
