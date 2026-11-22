import { describe, expect, it } from "vitest";
import { rebuildUserPluginFiles } from "../../../../../../src/contexts/installation/application/plugin/files/rebuild-user-plugin-files.js";
import { RecordedPlugin } from "../../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { PluginDistribution } from "../../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { saying } from "../../../../../shared/testing/saying.builder.js";
import { fakeBuiltDeps } from "../../../testing/fake-build-sources.fake.js";

const skill = { relativePath: "skills/demo/SKILL.md", content: "# Skill" };
const dist = new PluginDistribution({
  manifest: { name: "sample-plugin", version: "1.0.0" },
  format: TOOL.claude,
  files: [skill],
  components: { commands: [], agents: [], rules: [], skills: [skill], hooks: [], mcp: [] },
});
const plugin = RecordedPlugin.fromMetadata({
  name: "sample-plugin",
  version: "0.0.1",
  source: { kind: "local", path: "/source" },
  strict: false,
  scope: "user",
}).plugin;
const fs = new InMemoryFileAdapter();
const deps = { fs, builtDeps: fakeBuiltDeps(fs) };

describe("rebuilding a user plugin's files", () => {
  it("translates the distribution when the plugin has no registered marketplace", async () => {
    const { files } = await rebuildUserPluginFiles(deps, {
      dist,
      tool: registeredTools().aiProfile(TOOL.cursor),
      plugin,
      projectRoot: "/A",
    });

    expect(files.map((file) => file.relativePath)).toContain("sample-plugin/skills/demo/SKILL.md");
  });

  it("refuses to translate global files without the shared source", async () => {
    await expect(
      rebuildUserPluginFiles(deps, {
        dist,
        tool: registeredTools().aiProfile(TOOL.opencode),
        plugin,
        projectRoot: "/A",
      })
    ).rejects.toThrow(saying("run `aidd setup --global`"));
  });
});
