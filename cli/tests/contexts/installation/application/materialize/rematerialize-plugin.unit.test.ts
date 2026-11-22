import { describe, expect, it } from "vitest";
import { rematerializePlugin } from "../../../../../src/contexts/installation/application/materialize/rematerialize-plugin.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { fakeBuiltDeps } from "../../testing/fake-build-sources.fake.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.fake.js";

const NO_COMPONENTS = { skills: [], commands: [], agents: [], rules: [], hooks: [], mcp: [] };

function rematerialize() {
  const tool = registeredTools().aiProfile(TOOL.claude);
  const plugin = InstalledPlugin.fromMetadata({
    name: "aidd-dev",
    version: "1.0.0",
    source: { kind: "local", path: "/p" },
    strict: false,
    scope: "project",
    marketplace: "aidd-framework",
  });
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", []);
  manifest.addPlugin(TOOL.claude, plugin);
  const dist = new PluginDistribution({
    manifest: { name: "aidd-dev", version: "1.0.0" },
    format: TOOL.claude,
    files: [],
    components: NO_COMPONENTS,
  });
  const fs = new InMemoryFileAdapter();
  const count = rematerializePlugin(
    { dist, tool, mode: "marketplace", plugin, projectRoot: "/root", manifest },
    { fs, built: fakeBuiltDeps(fs) }
  );
  return { count, manifest };
}

async function rematerializeOnCursor(): Promise<number> {
  const tool = registeredTools().aiProfile(TOOL.cursor);
  const plugin = InstalledPlugin.fromMetadata({
    name: "aidd-dev",
    version: "1.0.0",
    source: { kind: "local", path: "/p" },
    strict: false,
    scope: "project",
    marketplace: "aidd-framework",
  });
  const manifest = Manifest.create();
  manifest.addTool(TOOL.cursor, "1.0.0", []);
  manifest.addPlugin(TOOL.cursor, plugin);
  const registry = new FakeMarketplaceRegistry();
  registry.seed("/root", {
    name: "aidd-framework",
    source: { kind: "local", path: "/src" },
    scope: "project",
  });
  const fs = new InMemoryFileAdapter();
  fs.setFile("/built/cursor/plugins/aidd-dev/skills/demo/SKILL.md", "built skill");
  const dist = new PluginDistribution({
    manifest: { name: "aidd-dev", version: "1.0.0" },
    format: TOOL.claude,
    files: [],
    components: NO_COMPONENTS,
  });
  return rematerializePlugin(
    { dist, tool, mode: "built-tree", plugin, projectRoot: "/root", manifest },
    { fs, built: { ...fakeBuiltDeps(fs), marketplaceRegistry: registry } }
  );
}

describe("rematerializePlugin()", () => {
  it("replaces the recorded entry with the one a fresh install would record", async () => {
    const { count, manifest } = rematerialize();

    await count;

    expect(manifest.getPlugins(TOOL.claude).map((p) => [p.name, p.marketplace])).toStrictEqual([
      ["aidd-dev", "aidd-framework"],
    ]);
  });

  it("reports zero for a placement that writes no files", async () => {
    expect(await rematerialize().count).toBe(0);
  });

  it("reports the files a built-tree placement wrote", async () => {
    expect(await rematerializeOnCursor()).toBe(1);
  });
});
