import { describe, expect, it } from "vitest";
import { builtPlacementOf } from "../../../../../src/composition/orchestration/built-placement.js";
import { rematerializePlugin } from "../../../../../src/contexts/installation/application/materialize/rematerialize-plugin.js";
import { hashOutputFiles } from "../../../../../src/contexts/installation/application/shared/hash-output-files.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../src/shared/domain/plugin/plugin-name.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { fakeBuiltDeps } from "../../testing/fake-build-sources.fake.js";

const RULE = ".codex/instructions/aidd-craft-01-standards-1-naming.md";
const OTHER = ".codex/plugins/aidd-craft/old.md";
const OLD_HASH = hashOutputFiles([{ relativePath: OTHER, content: "old" }])[0]?.hash.value ?? "";

describe("registering a marketplace plugin again", () => {
  it("drops the rule a newer version no longer ships, with everything else the registration never owned", async () => {
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
        [RULE, OLD_HASH],
        [OTHER, OLD_HASH],
      ])
    );
    manifest.addPlugin(TOOL.codex, recorded);

    const fs = new InMemoryFileAdapter(
      { [`/project/${RULE}`]: "old", [`/project/${OTHER}`]: "old" },
      ["/project"]
    );
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
        machine: Manifest.create(),
      },
      { fs, ...builtPlacementOf(fs, fakeBuiltDeps()) }
    );

    expect([
      [...(manifest.getPlugins(TOOL.codex)[0]?.files.keys() ?? [])],
      fs.has(`/project/${RULE}`),
      fs.has(`/project/${OTHER}`),
    ]).toEqual([[], false, false]);
  });
});
