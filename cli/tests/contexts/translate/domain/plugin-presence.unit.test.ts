import { describe, expect, it } from "vitest";
import { readPluginCanon } from "../../../../src/contexts/translate/application/sinks/plugin-source-tree-reader.js";
import { presenceOf } from "../../../../src/contexts/translate/domain/plugin-presence.js";
import { parsePluginName } from "../../../../src/shared/domain/plugin/plugin-name.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";

const PLUGIN_SRC = "/src/plugins/aidd-test";
const PLUGIN = { name: parsePluginName("aidd-test"), src: PLUGIN_SRC };

function canonOf(files: Record<string, string>) {
  return readPluginCanon(new InMemoryFileAdapter(files), PLUGIN, TOOL.claude);
}

describe("telling what a plugin ships", () => {
  it("names each agent markdown file relative to the agents directory, in order, and nothing else", async () => {
    const canon = await canonOf({
      [`${PLUGIN_SRC}/agents/planner.md`]: "# Planner",
      [`${PLUGIN_SRC}/agents/alpha.md`]: "# Alpha",
      [`${PLUGIN_SRC}/agents/nested/deep.md`]: "# Deep",
      [`${PLUGIN_SRC}/agents/notes.txt`]: "not an agent",
    });
    expect(presenceOf(canon).agentsList).toEqual(["alpha.md", "nested/deep.md", "planner.md"]);
  });

  it("names each skill folder once, in order, ignoring an entry file sitting at the skills root", async () => {
    const canon = await canonOf({
      [`${PLUGIN_SRC}/skills/commit/SKILL.md`]: "# Commit",
      [`${PLUGIN_SRC}/skills/apply/SKILL.md`]: "# Apply",
      [`${PLUGIN_SRC}/skills/apply/actions/run/SKILL.md`]: "# Run",
      [`${PLUGIN_SRC}/skills/apply/reference.json`]: "{}",
      [`${PLUGIN_SRC}/skills/SKILL.md`]: "# Loose",
      [`${PLUGIN_SRC}/skills/notes/readme.md`]: "# Notes",
      [`${PLUGIN_SRC}/skills/other/NOTSKILL.md`]: "# Not an entry",
      [`${PLUGIN_SRC}/skills/nested/group/SKILL.md`]: "# Nested",
    });
    expect(presenceOf(canon).skillsList).toEqual(["apply", "commit", "nested"]);
  });

  it("reports what a plugin shipping agents, skills, hooks and an mcp declaration holds", async () => {
    const canon = await canonOf({
      [`${PLUGIN_SRC}/agents/reviewer.md`]: "# Reviewer",
      [`${PLUGIN_SRC}/skills/hello/SKILL.md`]: "# Hello",
      [`${PLUGIN_SRC}/hooks/hooks.json`]:
        '{"hooks":{"SessionStart":[{"hooks":[{"type":"command","command":"node a.cjs"}]}]}}',
      [`${PLUGIN_SRC}/.mcp.json`]: '{"mcpServers":{"docs":{"url":"https://example.com/mcp"}}}',
    });
    expect(presenceOf(canon)).toEqual({
      hasAgents: true,
      agentsList: ["reviewer.md"],
      skillsList: ["hello"],
      hasHooksJson: true,
      hooks: { SessionStart: [{ hooks: [{ type: "command", command: "node a.cjs" }] }] },
      hasMcpJson: true,
      mcpServers: { docs: { url: "https://example.com/mcp" } },
    });
  });

  it("reports a plugin holding none of them", async () => {
    const canon = await canonOf({ [`${PLUGIN_SRC}/.claude-plugin/plugin.json`]: "{}" });
    expect(presenceOf(canon)).toEqual({
      hasAgents: false,
      agentsList: [],
      skillsList: [],
      hasHooksJson: false,
      hooks: {},
      hasMcpJson: false,
      mcpServers: {},
    });
  });

  it("names the plugin whose mcp declaration cannot be parsed", async () => {
    const canon = await canonOf({ [`${PLUGIN_SRC}/.mcp.json`]: "{ not json" });

    expect(() => presenceOf(canon)).toThrow(
      expect.objectContaining({ detail: expect.stringContaining("plugin 'aidd-test' MCP config") })
    );
  });
});
