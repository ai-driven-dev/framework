import { describe, expect, it } from "vitest";
import { readTranslatedBuiltTree } from "../../../../../src/contexts/installation/application/materialize/read-translated-built-tree.js";
import type { BuiltMaterializationDeps } from "../../../../../src/contexts/installation/application/shared/built-materialization-deps.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { fakeBuiltDeps, translateDistribution } from "../../testing/fake-build-sources.fake.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.fake.js";

async function readBuilt(
  fs: InMemoryFileAdapter,
  translate: BuiltMaterializationDeps["translate"] = translateDistribution
) {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.cursor, "test", []);
  return readTranslatedBuiltTree(
    {
      dist: new PluginDistribution({
        manifest: { name: "sample-plugin", version: "1.0.0" },
        format: TOOL.claude,
        files: [],
        components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
      }),
      tool: registeredTools().aiProfile(TOOL.cursor),
      source: { kind: "local", path: "/source" },
      projectRoot: "/proj",
      manifest,
      marketplace: "aidd-framework",
    },
    {
      deps: {
        fs,
        built: fakeBuiltDeps(fs, {
          homedir: () => "/home/u",
          marketplaceRegistry: new FakeMarketplaceRegistry(),
          translate,
        }),
      },
      marketplace: {
        name: "aidd-framework",
        source: { kind: "local", path: "/src" },
        scope: "project",
      },
      mode: "marketplace",
    }
  );
}

describe("readTranslatedBuiltTree", () => {
  it("reads the built plugin tree and reports no mcp entry for a plugin declaring none", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile("/built/cursor/plugins/sample-plugin/skills/demo/SKILL.md", "built skill");

    const { files, mcp } = await readBuilt(fs);

    expect(files.map((f) => f.relativePath)).toStrictEqual(["sample-plugin/skills/demo/SKILL.md"]);
    expect(mcp.mcpEntries.size).toBe(0);
  });

  it("leaves out a built file the translation says the tool drops", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile("/built/cursor/plugins/sample-plugin/skills/demo/SKILL.md", "built skill");
    fs.setFile("/built/cursor/plugins/sample-plugin/skills/demo/extra.md", "dropped");
    const translate: BuiltMaterializationDeps["translate"] = {
      execute: (command) => ({
        ...translateDistribution.execute(command),
        dropsBuiltFile: (path) => path.endsWith("extra.md"),
      }),
    };

    const { files } = await readBuilt(fs, translate);

    expect(files.map((f) => f.relativePath)).toStrictEqual(["sample-plugin/skills/demo/SKILL.md"]);
  });
});
