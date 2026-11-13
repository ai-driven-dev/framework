import { describe, expect, it } from "vitest";
import {
  buildCopilotFlatContract,
  buildCopilotMarketplaceContract,
} from "../../../../../../src/contexts/tools/domain/profiles/copilot/build.js";
import { parseFrontmatter } from "../../../../../../src/kernel/markdown.js";
import { InMemoryFileAdapter } from "../../../../../helpers/ports/in-memory-file-adapter.js";
import { supported } from "../../../testing/build-artifacts.js";

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

const HOOKS_JSON = JSON.stringify({
  hooks: {
    SessionStart: [{ hooks: [{ type: "command", command: "node journal.cjs", timeout: 30 }] }],
  },
});

describe("buildCopilotMarketplaceContract()", () => {
  it("declares Copilot's own plugin manifest path and root token, and validates it against no schema", () => {
    const contract = buildCopilotMarketplaceContract();

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
    const manifest = buildCopilotMarketplaceContract().synthesizeManifest?.(
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
      hooks: "./hooks/hooks.json",
      mcpServers: "./.mcp.json",
    });
  });

  it("keeps what Copilot reads of an agent and links its plugin-root references from agents/", () => {
    const transform = supported(buildCopilotMarketplaceContract().artifacts.agents).transform;

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
    const built = await buildCopilotMarketplaceContract().buildMarketplaceCatalog?.(
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

    const entry = await buildCopilotMarketplaceContract().buildMarketplaceEntry?.(
      "aidd-dev",
      "/src/plugins/aidd-dev",
      "/out",
      undefined,
      fs
    );

    expect(entry).toStrictEqual({
      name: "aidd-dev",
      source: "aidd-dev",
      description: "Development loop",
      version: "1.2.3",
    });
  });
});

describe("buildCopilotFlatContract()", () => {
  it("lands a plugin's hooks declaration beside the other hooks and its scripts under the plugin's own folder", () => {
    const hooks = supported(buildCopilotFlatContract().artifacts.hooks);

    expect({
      declaration: hooks.path("aidd-dev", "hooks/aidd-dev.hooks.json"),
      script: hooks.path("aidd-dev", "hooks/journal.cjs"),
    }).toStrictEqual({
      declaration: ".github/hooks/aidd-dev.hooks.json",
      script: ".github/hooks/aidd-dev/journal.cjs",
    });
  });

  it("flattens a plugin's hooks declaration into the one-entry-per-event shape Copilot reads", () => {
    const hooks = supported(buildCopilotFlatContract().artifacts.hooks);

    expect([hooks.hooksFile?.path("aidd-dev"), hooks.hooksFile?.shared]).toStrictEqual([
      ".github/hooks/aidd-dev.hooks.json",
      false,
    ]);
    expect(hooks.hooksFile?.merge(null, HOOKS_JSON, "aidd-dev", (path) => path).content).toBe(
      `${JSON.stringify(
        {
          version: 1,
          hooks: {
            SessionStart: [{ type: "command", command: "node journal.cjs", timeout: 30 }],
          },
        },
        null,
        2
      )}\n`
    );
  });

  it("adds a plugin's mcp servers to the workspace .vscode/mcp.json under servers", () => {
    const mcp = supported(buildCopilotFlatContract().artifacts.mcp);

    expect({
      path: mcp.path("aidd-dev", ".mcp.json"),
      mcpServersKey: mcp.mcpServersKey,
      mergeDest: mcp.mergeDest?.("/out"),
      merged: mcp.merge?.(null, { "aidd-dev-context": { command: "node" } }, false),
    }).toStrictEqual({
      path: ".vscode/mcp.json",
      mcpServersKey: "servers",
      mergeDest: "/out/.vscode/mcp.json",
      merged: {
        mergedContent:
          '{\n  "servers": {\n    "aidd-dev-context": {\n      "command": "node"\n    }\n  }\n}\n',
        collisions: [],
      },
    });
  });

  it("renames a skill folder after its plugin, only for a path that starts with skills/", () => {
    const skills = supported(buildCopilotFlatContract().artifacts.skills);

    expect(skills.path("aidd-dev", "skills/01-plan/SKILL.md")).toBe(
      ".github/skills/aidd-dev-01-plan/SKILL.md"
    );
    expect(skills.path("aidd-dev", "docs/skills/x.md")).toBe(
      ".github/skills/aidd-dev-docs/skills/x.md"
    );
    expect(skills.rewriteSkillName).toBe(true);
  });

  it("names a flat agent from its path, dropping agents/ only at the start", () => {
    const { path } = supported(buildCopilotFlatContract().artifacts.agents);

    expect(path("aidd-dev", "docs/agents/x.md")).toBe(
      ".github/agents/aidd-dev-docs/agents/x.agent.md"
    );
  });

  it("keeps only the fields Copilot reads of a hook entry", () => {
    const hooks = supported(buildCopilotFlatContract().artifacts.hooks);
    const incoming = JSON.stringify({
      hooks: {
        PostToolUse: [
          {
            matcher: "Write",
            hooks: [{ type: "command", command: "node a.cjs", timeout: 5, extra: 1 }],
          },
        ],
      },
    });

    const written = JSON.parse(
      hooks.hooksFile?.merge(null, incoming, "aidd-dev", (path) => path).content ?? ""
    );

    expect(written.hooks.PostToolUse).toStrictEqual([
      { type: "command", command: "node a.cjs", matcher: "Write", timeout: 5 },
    ]);
  });

  it("renames a flat agent after its plugin, drops what Copilot cannot read, and points its references at their flat destinations", () => {
    const transform = supported(buildCopilotFlatContract().artifacts.agents).transform;

    expect(transform?.(AGENT_SOURCE, "aidd-dev", "planner.md")).toBe(
      [
        "---",
        "name: 'aidd-dev-planner'",
        "description: 'Plans the work'",
        "model: 'opus'",
        "include-custom-instructions: true",
        "---",
        "Read [SKILL.md](../skills/aidd-dev-01-plan/SKILL.md)",
        "Ask [reviewer.md](./aidd-dev-reviewer.agent.md)",
        "Run [journal.cjs](../../hooks/journal.cjs)",
        "",
      ].join("\n")
    );
  });

  it("drops only the trailing .md from the name it gives a flat agent", () => {
    const transform = supported(buildCopilotFlatContract().artifacts.agents).transform;

    expect(
      transform?.("---\ndescription: Helps\n---\nBody.\n", "aidd-dev", "notes.md-helper.md")
    ).toBe(
      "---\nname: 'aidd-dev-notes.md-helper'\ndescription: 'Helps'\ninclude-custom-instructions: true\n---\nBody.\n"
    );
  });

  it.each([true, false])(
    "preserves repository instruction selection %s in flat agents",
    (include) => {
      const transform = supported(buildCopilotFlatContract().artifacts.agents).transform;
      const result = transform?.(
        `---\nname: reviewer\ninclude-custom-instructions: ${include}\n---\nReview.\n`,
        "aidd-dev",
        "reviewer.md"
      );
      expect(parseFrontmatter(result ?? "").frontmatter["include-custom-instructions"]).toBe(
        include
      );
    }
  );
});
