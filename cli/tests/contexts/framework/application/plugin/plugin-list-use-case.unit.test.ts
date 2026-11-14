import { describe, expect, it } from "vitest";
import { PluginListUseCase } from "../../../../../src/contexts/framework/application/plugin/plugin-list-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../../../../src/contexts/framework/domain/ports/manifest-repository.js";
import { registeredCatalog, TOOL } from "../../../tools/testing/catalog-of.js";

function makeManifestWithPlugin(): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", []);
  const plugin = InstalledPlugin.fromJSON({
    name: "sample-plugin",
    source: { kind: "local", path: "./sample" },
    version: "1.0.0",
    strict: false,
    files: {},
    scope: "project",
  });
  manifest.addPlugin(TOOL.claude, plugin);
  return manifest;
}

function makeManifestRepository(manifest: Manifest): ManifestRepository {
  return {
    path: "/test-project/.aidd/manifest.json",
    load: async () => manifest,
    save: async () => {},
    delete: async () => {},
  };
}

describe("PluginListUseCase", () => {
  describe("list plugins for installed tool", () => {
    it("returns map with installed plugins for requested tool", async () => {
      const manifest = makeManifestWithPlugin();
      const repo = makeManifestRepository(manifest);
      const useCase = new PluginListUseCase(repo);
      const result = await useCase.execute({ toolIds: [TOOL.claude], tools: registeredCatalog() });
      expect(result.has(TOOL.claude)).toBe(true);
      const plugins = result.get(TOOL.claude) ?? [];
      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe("sample-plugin");
      expect(plugins[0].version).toBe("1.0.0");
    });

    it("returns empty list for tool with no plugins", async () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "1.0.0", []);
      const repo = makeManifestRepository(manifest);
      const useCase = new PluginListUseCase(repo);
      const result = await useCase.execute({ toolIds: [TOOL.claude], tools: registeredCatalog() });
      expect(result.get(TOOL.claude)).toHaveLength(0);
    });
  });
});
