import { describe, expect, it } from "vitest";
import {
  presenceOf,
  readPluginCanon,
} from "../../../../../src/contexts/translate/application/sinks/plugin-source-tree-reader.js";
import { parsePluginName } from "../../../../../src/shared/domain/plugin/plugin-name.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { WindowsListingFileAdapter } from "../../../../shared/testing/windows-listing-file-adapter.fake.js";

const PLUGIN_SRC = "/src/plugins/aidd-test";
const PLUGIN = { name: parsePluginName("aidd-test"), src: PLUGIN_SRC };

function canonOf(files: Record<string, string>, fs = new InMemoryFileAdapter(files)) {
  return readPluginCanon(fs, PLUGIN, TOOL.claude);
}

describe("reading a plugin's source tree", () => {
  it("holds every file under the plugin folder, named from the plugin root", async () => {
    const canon = await canonOf({
      [`${PLUGIN_SRC}/README.md`]: "# Readme",
      [`${PLUGIN_SRC}/.claude-plugin/plugin.json`]: "{}",
      [`${PLUGIN_SRC}/skills/hello/SKILL.md`]: "# Hello",
      "/src/plugins/other/skills/x.md": "# Another plugin",
    });
    expect(canon.files.map((file) => file.relativePath).sort()).toEqual([
      ".claude-plugin/plugin.json",
      "README.md",
      "skills/hello/SKILL.md",
    ]);
    expect(canon.files.find((file) => file.relativePath === "README.md")?.content).toBe("# Readme");
  });

  it("sorts each file into the component it belongs to", async () => {
    const canon = await canonOf({
      [`${PLUGIN_SRC}/agents/planner.md`]: "# Planner",
      [`${PLUGIN_SRC}/skills/hello/SKILL.md`]: "# Hello",
      [`${PLUGIN_SRC}/hooks/hooks.json`]: "{}",
      [`${PLUGIN_SRC}/.mcp.json`]: "{}",
      [`${PLUGIN_SRC}/README.md`]: "# Readme",
    });
    const names = (files: readonly { relativePath: string }[]) => files.map((f) => f.relativePath);
    expect(names(canon.components.agents)).toEqual(["agents/planner.md"]);
    expect(names(canon.components.skills)).toEqual(["skills/hello/SKILL.md"]);
    expect(names(canon.components.hooks)).toEqual(["hooks/hooks.json"]);
    expect(names(canon.components.mcp)).toEqual([".mcp.json"]);
  });

  it("names a file a Windows listing separates with backslashes with forward slashes", async () => {
    const fs = new WindowsListingFileAdapter({ [`${PLUGIN_SRC}/agents/sub/deep.md`]: "# Deep" });
    const canon = await canonOf({}, fs);
    expect(canon.components.agents.map((file) => file.relativePath)).toEqual([
      "agents/sub/deep.md",
    ]);
  });
});

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
      [`${PLUGIN_SRC}/hooks/hooks.json`]: "{}",
      [`${PLUGIN_SRC}/.mcp.json`]: "{}",
    });
    expect(presenceOf(canon)).toEqual({
      hasAgents: true,
      agentsList: ["reviewer.md"],
      skillsList: ["hello"],
      hasHooksJson: true,
      hasMcpJson: true,
    });
  });

  it("reports a plugin holding none of them", async () => {
    const canon = await canonOf({ [`${PLUGIN_SRC}/.claude-plugin/plugin.json`]: "{}" });
    expect(presenceOf(canon)).toEqual({
      hasAgents: false,
      agentsList: [],
      skillsList: [],
      hasHooksJson: false,
      hasMcpJson: false,
    });
  });
});
