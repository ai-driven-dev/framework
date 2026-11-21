import { describe, expect, it } from "vitest";
import type { ArtifactContract } from "../../../../../../src/contexts/tools/contract/build-contract.js";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/claude.profile.js";
import { present } from "../../../../../shared/testing/present.builder.js";
import { supported } from "../../../testing/build-artifacts.builder.js";

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

const HOOKS_JSON = JSON.stringify({
  hooks: { Stop: [{ hooks: [{ type: "command", command: "node journal.cjs" }] }] },
});

describe("present(claude.buildContracts.marketplace)()", () => {
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
    const transform = supported(
      present(claude.buildContracts.marketplace)().artifacts.agents
    ).transform;

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

describe("present(claude.buildContracts.flat)()", () => {
  it("lands a plugin's hooks declaration beside Claude's hooks and its scripts under the plugin's own folder", () => {
    const hooks = supported(present(claude.buildContracts.flat)().artifacts.hooks);

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
    const hooks = supported(present(claude.buildContracts.flat)().artifacts.hooks);

    expect(
      hooks.hooksFile?.merge(JSON.stringify({ model: "opus" }), {
        json: HOOKS_JSON,
        plugin: "aidd-dev",
        locate: (path) => path,
      })
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
    const mcp = supported(present(claude.buildContracts.flat)().artifacts.mcp);

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
    const transform = supported(present(claude.buildContracts.flat)().artifacts.agents).transform;

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

  it("keeps an inner .md in a flat agent's declared name and removes only the extension", () => {
    const transform = supported(present(claude.buildContracts.flat)().artifacts.agents).transform;

    expect(transform?.(AGENT_SOURCE, "aidd-dev", "notes.md-helper.md")).toContain(
      "name: 'aidd-dev-notes.md-helper'"
    );
  });
});

function mergeIntoSettings(pluginHooks: string): unknown {
  const hooks: ArtifactContract = present(claude.buildContracts.flat)().artifacts.hooks;
  if (!hooks.supported || hooks.hooksFile === undefined) throw new Error("no hooks file");
  return JSON.parse(
    hooks.hooksFile.merge(null, { json: pluginHooks, plugin: "p", locate: (path) => path }).content
  );
}

describe("what a plugin ships, merged into .claude/settings.json", () => {
  it("keeps a hook that runs no command, and every key of its group", () => {
    const group = {
      matcher: "Write",
      label: "review",
      hooks: [
        { type: "prompt", prompt: "check" },
        { type: "agent", agent: "reviewer" },
      ],
    };

    expect(mergeIntoSettings(JSON.stringify({ hooks: { PostToolUse: [group] } }))).toStrictEqual({
      hooks: { PostToolUse: [group] },
    });
  });
});
