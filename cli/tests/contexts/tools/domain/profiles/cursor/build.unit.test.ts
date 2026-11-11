import { describe, expect, it } from "vitest";
import {
  buildCursorContract,
  buildCursorFlatContract,
} from "../../../../../../src/contexts/tools/domain/profiles/cursor/build.js";
import { parseFrontmatter } from "../../../../../../src/kernel/markdown.js";
import { InMemoryFileAdapter } from "../../../../../helpers/ports/in-memory-file-adapter.js";
import {
  PLUGIN_RELATIVE_PATHS,
  PLUGIN_TREE_SOURCES,
  pluginRelativePathsOf,
  pluginTreeSourcesOf,
  supported,
} from "../../../testing/build-artifacts.js";

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

describe("buildCursorContract()", () => {
  it("gives same-named plugin roles distinct native identities", () => {
    const transform = supported(buildCursorContract().artifacts.agents).transform;
    const first = transform?.(AGENT_SOURCE, "first-plugin", "planner.md") ?? "";
    const second = transform?.(AGENT_SOURCE, "second-plugin", "planner.md") ?? "";
    expect(parseFrontmatter(first).frontmatter.name).toBe("first-plugin-planner");
    expect(parseFrontmatter(second).frontmatter.name).toBe("second-plugin-planner");
  });

  it("drops only the file's final .md from a plugin agent's name", () => {
    const transform = supported(buildCursorContract().artifacts.agents).transform;
    const output = transform?.(AGENT_SOURCE, "aidd-dev", "read.md-first.md") ?? "";

    expect(parseFrontmatter(output).frontmatter.name).toBe("aidd-dev-read.md-first");
  });

  it("declares Cursor's own plugin manifest path, schema and root token", () => {
    const contract = buildCursorContract();

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
    const manifest = buildCursorContract().synthesizeManifest?.(
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

  it("sources skills, agents, mcp and hooks from the plugin tree, and neither rules nor commands", () => {
    expect(pluginTreeSourcesOf(buildCursorContract().artifacts)).toStrictEqual(PLUGIN_TREE_SOURCES);
  });

  it("keeps every artifact at the plugin-relative path it came from", () => {
    expect(pluginRelativePathsOf(buildCursorContract().artifacts)).toStrictEqual(
      PLUGIN_RELATIVE_PATHS
    );
  });

  it("keeps an agent's supported frontmatter and links its plugin-root references from agents/", () => {
    const transform = supported(buildCursorContract().artifacts.agents).transform;

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

  it("builds the catalog Cursor reads, at .cursor-plugin/marketplace.json", async () => {
    const built = await buildCursorContract().buildMarketplaceCatalog?.(
      {
        name: "aidd",
        version: "1.0.0",
        description: "AI Driven Dev",
        owner: { name: "AIDD" },
        plugins: [],
      },
      [{ name: "aidd-dev", source: "./plugins/aidd-dev" }],
      new InMemoryFileAdapter()
    );

    expect(built).toStrictEqual({
      catalog: {
        name: "aidd",
        version: "1.0.0",
        description: "AI Driven Dev",
        owner: { name: "AIDD" },
        plugins: [{ name: "aidd-dev", source: "./plugins/aidd-dev" }],
      },
      schemaName: "claude-marketplace",
      destRelPath: ".cursor-plugin/marketplace.json",
    });
  });

  it("builds a catalog entry from the plugin manifest already written to the output tree", async () => {
    const fs = new InMemoryFileAdapter({
      "/out/plugins/aidd-dev/.cursor-plugin/plugin.json": JSON.stringify({
        version: "1.2.3",
        description: "Development loop",
      }),
    });

    const entry = await buildCursorContract().buildMarketplaceEntry?.(
      "aidd-dev",
      "/src/plugins/aidd-dev",
      "/out",
      undefined,
      fs
    );

    expect(entry).toStrictEqual({
      name: "aidd-dev",
      source: "./plugins/aidd-dev",
      description: "Development loop",
      version: "1.2.3",
    });
  });
});

describe("buildCursorFlatContract()", () => {
  it("sources the same trees as the plugin contract, and neither rules nor commands", () => {
    expect(pluginTreeSourcesOf(buildCursorFlatContract().artifacts)).toStrictEqual(
      PLUGIN_TREE_SOURCES
    );
  });

  it("prefixes a flat skill's own folder with the plugin name, and renames the skill itself", () => {
    const skills = supported(buildCursorFlatContract().artifacts.skills);

    expect({
      path: skills.path("aidd-dev", "skills/01-plan/SKILL.md"),
      rewriteSkillName: skills.rewriteSkillName,
    }).toStrictEqual({
      path: ".cursor/skills/aidd-dev-01-plan/SKILL.md",
      rewriteSkillName: true,
    });
  });

  it("prefixes a flat agent's file with the plugin name and keeps it markdown", () => {
    const agents = supported(buildCursorFlatContract().artifacts.agents);

    expect(agents.path("aidd-dev", "agents/planner.md")).toBe(".cursor/agents/aidd-dev-planner.md");
  });

  it("lands a plugin's hooks declaration beside Cursor's hooks and its scripts under the plugin's own folder", () => {
    const hooks = supported(buildCursorFlatContract().artifacts.hooks);

    expect({
      declaration: hooks.path("aidd-dev", "hooks/aidd-dev.hooks.json"),
      script: hooks.path("aidd-dev", "hooks/journal.cjs"),
      file: [hooks.hooksFile?.path("aidd-dev"), hooks.hooksFile?.shared],
    }).toStrictEqual({
      declaration: ".cursor/hooks/aidd-dev.hooks.json",
      script: ".cursor/hooks/aidd-dev/journal.cjs",
      file: [".cursor/hooks.json", true],
    });
  });

  it("adds a plugin's mcp servers to the workspace .cursor/mcp.json under mcpServers", () => {
    const mcp = supported(buildCursorFlatContract().artifacts.mcp);

    expect({
      path: mcp.path("aidd-dev", ".mcp.json"),
      mcpServersKey: mcp.mcpServersKey,
      mergeDest: mcp.mergeDest?.("/out"),
      merged: mcp.merge?.(null, { "aidd-dev-context": { command: "node" } }, false),
    }).toStrictEqual({
      path: ".cursor/mcp.json",
      mcpServersKey: "mcpServers",
      mergeDest: "/out/.cursor/mcp.json",
      merged: {
        mergedContent:
          '{\n  "mcpServers": {\n    "aidd-dev-context": {\n      "command": "node"\n    }\n  }\n}\n',
        collisions: [],
      },
    });
  });

  it("drops only the file's own .md from a flat agent's name", () => {
    const transform = supported(buildCursorFlatContract().artifacts.agents).transform;

    expect(transform?.(AGENT_SOURCE, "aidd-dev", "read.md-first.md")).toMatch(
      /^name: "aidd-dev-read\.md-first"$/mu
    );
  });

  it("renames a flat agent after its plugin and points its references at their flat destinations", () => {
    const transform = supported(buildCursorFlatContract().artifacts.agents).transform;

    expect(transform?.(AGENT_SOURCE, "aidd-dev", "planner.md")).toBe(
      [
        "---",
        'name: "aidd-dev-planner"',
        'description: "Plans the work"',
        'model: "opus"',
        "---",
        "Read [SKILL.md](../skills/aidd-dev-01-plan/SKILL.md)",
        "Ask [reviewer.md](./aidd-dev-reviewer.md)",
        "Run [journal.cjs](../../hooks/journal.cjs)",
        "",
      ].join("\n")
    );
  });
});
