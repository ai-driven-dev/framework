import { describe, expect, it } from "vitest";
import { artifactPath } from "../../../../../../src/contexts/tools/contract/artifact-path.js";
import { cursor } from "../../../../../../src/contexts/tools/domain/profiles/cursor/cursor.profile.js";
import { buildCursorContract } from "../../../../../../src/contexts/tools/domain/profiles/cursor/cursor-build.model.js";
import { parseFrontmatter } from "../../../../../../src/shared/domain/markdown.js";
import { builtAgent } from "../../../../../shared/testing/built-agent.builder.js";
import { present } from "../../../../../shared/testing/present.builder.js";
import { supported } from "../../../testing/build-artifacts.builder.js";

const HOOKS = present(cursor.hooks);

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
    const transform = builtAgent(buildCursorContract(HOOKS), "marketplace");
    const first = transform?.(AGENT_SOURCE, "first-plugin", "planner.md") ?? "";
    const second = transform?.(AGENT_SOURCE, "second-plugin", "planner.md") ?? "";
    expect(parseFrontmatter(first).frontmatter.name).toBe("first-plugin-planner");
    expect(parseFrontmatter(second).frontmatter.name).toBe("second-plugin-planner");
  });

  it("drops only the file's final .md from a plugin agent's name", () => {
    const transform = builtAgent(buildCursorContract(HOOKS), "marketplace");
    const output = transform?.(AGENT_SOURCE, "aidd-dev", "read.md-first.md") ?? "";

    expect(parseFrontmatter(output).frontmatter.name).toBe("aidd-dev-read.md-first");
  });

  it("declares Cursor's own plugin manifest path, schema and root token", () => {
    const contract = buildCursorContract(HOOKS);

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
    const manifest = buildCursorContract(HOOKS).synthesizeManifest?.(
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

  it("keeps an agent's supported frontmatter and links its plugin-root references from agents/", () => {
    const transform = builtAgent(buildCursorContract(HOOKS), "marketplace");

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

describe("building Cursor's flat contract", () => {
  it("lands a plugin's hooks declaration beside Cursor's hooks and its scripts under the plugin's own folder", () => {
    const hooks = supported(present(cursor.buildContracts.flat)().artifacts.hooks);

    expect({
      declaration: artifactPath(hooks, "aidd-dev", "hooks/aidd-dev.hooks.json"),
      script: artifactPath(hooks, "aidd-dev", "hooks/journal.cjs"),
      file: hooks.hooksFile?.at,
    }).toStrictEqual({
      declaration: ".cursor/hooks/aidd-dev.hooks.json",
      script: ".cursor/hooks/aidd-dev/journal.cjs",
      file: { shared: ".cursor/hooks.json" },
    });
  });

  it("adds a plugin's mcp servers to the workspace .cursor/mcp.json under mcpServers", () => {
    const mcp = supported(present(cursor.buildContracts.flat)().artifacts.mcp);

    expect({
      path: artifactPath(mcp, "aidd-dev", ".mcp.json"),
      mcpServersKey: mcp.mcpServersKey,
    }).toStrictEqual({
      path: ".cursor/mcp.json",
      mcpServersKey: "mcpServers",
    });
  });

  it("drops only the file's own .md from a flat agent's name", () => {
    const transform = builtAgent(present(cursor.buildContracts.flat)(), "flat");

    expect(transform?.(AGENT_SOURCE, "aidd-dev", "read.md-first.md")).toMatch(
      /^name: "aidd-dev-read\.md-first"$/mu
    );
  });

  it("renames a flat agent after its plugin and points its references at their flat destinations", () => {
    const transform = builtAgent(present(cursor.buildContracts.flat)(), "flat");

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

  it("strips only the leading agents/ or skills/ segment from a flat destination", () => {
    const { agents, skills } = present(cursor.buildContracts.flat)().artifacts;

    expect(artifactPath(supported(agents), "aidd-dev", "deep/agents/x.md")).toBe(
      ".cursor/agents/aidd-dev-deep/agents/x.md"
    );
    expect(artifactPath(supported(skills), "aidd-dev", "deep/skills/x")).toBe(
      ".cursor/skills/aidd-dev-deep/skills/x"
    );
  });

  it("resolves a flat agent's references from the folder the file lands in, by its file name alone", () => {
    const transform = builtAgent(present(cursor.buildContracts.flat)(), "flat");
    const source = `---\nname: x\n---\nAsk @${ROOT}/agents/reviewer.md\n`;

    expect(transform(source, "aidd-dev", "team/lead.md")).toContain(
      "Ask [reviewer.md](./aidd-dev-reviewer.md)"
    );
  });
});

describe("an event Cursor does not fire", () => {
  const notify = JSON.stringify({ hooks: { Notification: [{ hooks: [{ command: "a" }] }] } });

  it("is skipped and reported under Cursor's name by a flat build", () => {
    const hooks = supported(present(cursor.buildContracts.flat)().artifacts.hooks);
    if (hooks.hooksFile === undefined) throw new Error("no hooks file");

    expect(
      hooks.hooksFile.merge(null, { json: notify, plugin: "p", locate: (path) => path }).warnings
    ).toStrictEqual(["cursor: unmapped event 'Notification' skipped"]);
  });
});
