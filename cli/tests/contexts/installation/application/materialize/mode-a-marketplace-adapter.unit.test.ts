// Idempotency and the empty-marketplace-list case live on SyncSettings; this
// translator only registers the plugin reference in the manifest, with empty files.
import { describe, expect, it } from "vitest";
import { ModeAMarketplaceTranslator } from "../../../../../src/contexts/installation/application/materialize/mode-a-marketplace-translator.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { registeredAiProfile, TOOL } from "../../../tools/testing/catalog-of.js";

function buildDist(name = "test-plugin"): PluginDistribution {
  return new PluginDistribution({
    manifest: { name, version: "1.0.0" },
    format: TOOL.claude,
    files: [{ relativePath: "commands/hello.md", content: "# Hello" }],
    components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
  });
}

function buildAdapter() {
  return { adapter: new ModeAMarketplaceTranslator() };
}

describe("ModeAMarketplaceTranslator", () => {
  describe("mode discriminant", () => {
    it("exposes mode as marketplace", () => {
      const { adapter } = buildAdapter();
      expect(adapter.mode).toBe("marketplace");
    });
  });

  describe("when adding a plugin for a native tool with marketplace", () => {
    it("registers plugin in manifest with empty files (no materialization)", async () => {
      const { adapter } = buildAdapter();
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "test", []);
      const dist = buildDist("aidd-context");
      await adapter.addPlugin(
        dist,
        registeredAiProfile(TOOL.claude),
        { kind: "local", path: "/plugin-source" },
        "/project",
        manifest,
        "aidd-framework"
      );
      const plugins = manifest.getPlugins(TOOL.claude);
      const installed = plugins.find((p) => p.name === "aidd-context");
      expect(installed).toBeDefined();
      expect(installed?.files.size).toBe(0);
      expect(installed?.marketplace).toBe("aidd-framework");
    });

    it("reports nothing skipped, since nothing was translated", async () => {
      const { adapter } = buildAdapter();
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "test", []);

      const result = await adapter.addPlugin(
        buildDist("aidd-context"),
        registeredAiProfile(TOOL.claude),
        { kind: "local", path: "/plugin-source" },
        "/project",
        manifest,
        "aidd-framework"
      );

      expect(result).toStrictEqual({ skipped: [] });
    });
  });

  describe("when adding a plugin without marketplace", () => {
    it("registers plugin in manifest with undefined marketplace", async () => {
      const { adapter } = buildAdapter();
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "test", []);
      const dist = buildDist("test-plugin");
      await adapter.addPlugin(
        dist,
        registeredAiProfile(TOOL.claude),
        { kind: "local", path: "/plugin-source" },
        "/project",
        manifest,
        undefined
      );
      const plugins = manifest.getPlugins(TOOL.claude);
      const installed = plugins.find((p) => p.name === "test-plugin");
      expect(installed).toBeDefined();
      expect(installed?.marketplace).toBeUndefined();
      expect(installed?.files.size).toBe(0);
    });
  });
});
