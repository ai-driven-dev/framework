import { describe, expect, it } from "vitest";
import { rematerializePlugin } from "../../../../../src/contexts/installation/application/materialize/rematerialize-plugin.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../src/shared/domain/plugin/plugin-name.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const RULE = ".codex/instructions/aidd-craft-1-naming.md";
const OTHER = ".codex/plugins/aidd-craft/old.md";

describe("registering a marketplace plugin again", () => {
  it("keeps the rules it placed in the project recorded, and drops what the registration never owned", async () => {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.codex, "1.0.0", []);
    const recorded = RecordedPlugin.fromMetadata({
      name: "aidd-craft",
      version: "1.0.0",
      source: { kind: "local", path: "/fixture" },
      strict: false,
      scope: "project",
      marketplace: "aidd-framework",
    }).withFiles(
      new Map([
        [RULE, "h1"],
        [OTHER, "h2"],
      ])
    );
    manifest.addPlugin(TOOL.codex, recorded);

    await rematerializePlugin(
      {
        dist: new PluginDistribution({
          manifest: { name: parsePluginName("aidd-craft"), version: "1.1.0" },
          format: TOOL.claude,
          files: [],
          components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
        }),
        tool: registeredTools().aiProfile(TOOL.codex),
        mode: "marketplace",
        plugin: recorded,
        projectRoot: "/project",
        manifest,
      },
      async () => ({ skipped: [] })
    );

    expect([...(manifest.getPlugins(TOOL.codex)[0]?.files.keys() ?? [])]).toEqual([RULE]);
  });
});
