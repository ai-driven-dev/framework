// Idempotency and the empty-marketplace-list case live on SyncSettings; this
// registration only adds the plugin reference in the manifest, with empty files.
import { describe, expect, it } from "vitest";
import { registerMarketplacePlugin } from "../../../../../src/contexts/installation/application/materialize/register-marketplace-plugin.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

function buildDist(name = "test-plugin"): PluginDistribution {
  return new PluginDistribution({
    manifest: { name, version: "1.0.0" },
    format: TOOL.claude,
    files: [{ relativePath: "commands/hello.md", content: "# Hello" }],
    components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
  });
}

describe("registering a marketplace plugin", () => {
  describe("when adding a plugin for a native tool with marketplace", () => {
    it("registers plugin in manifest with empty files (no materialization)", async () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "test", []);
      const dist = buildDist("aidd-context");
      await registerMarketplacePlugin({
        dist,
        tool: registeredTools().aiProfile(TOOL.claude),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: "/project",
        manifest,
        marketplace: "aidd-framework",
      });
      const plugins = manifest.getRecordedPlugins(TOOL.claude);
      const installed = plugins.find((p) => p.plugin.name === "aidd-context");
      expect(installed).toBeDefined();
      expect(installed?.plugin.files.size).toBe(0);
      expect(installed?.marketplace).toBe("aidd-framework");
    });

    it("reports nothing skipped, since nothing was translated", async () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "test", []);

      const result = await registerMarketplacePlugin({
        dist: buildDist("aidd-context"),
        tool: registeredTools().aiProfile(TOOL.claude),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: "/project",
        manifest,
        marketplace: "aidd-framework",
      });

      expect(result).toStrictEqual({ skipped: [] });
    });
  });

  describe("when adding a plugin without marketplace", () => {
    it("registers plugin in manifest with undefined marketplace", async () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "test", []);
      const dist = buildDist("test-plugin");
      await registerMarketplacePlugin({
        dist,
        tool: registeredTools().aiProfile(TOOL.claude),
        source: { kind: "local", path: "/plugin-source" },
        projectRoot: "/project",
        manifest,
        marketplace: undefined,
      });
      const plugins = manifest.getRecordedPlugins(TOOL.claude);
      const installed = plugins.find((p) => p.plugin.name === "test-plugin");
      expect(installed).toBeDefined();
      expect(installed?.marketplace).toBeUndefined();
      expect(installed?.plugin.files.size).toBe(0);
    });
  });
});
