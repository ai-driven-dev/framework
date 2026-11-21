import { describe, expect, it } from "vitest";
import { ListPlugins } from "../../../../../src/contexts/installation/application/plugin/list-plugins.use-case.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../../../../src/contexts/installation/ports/manifest-repository.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";

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

describe("ListPlugins", () => {
  describe("list plugins for installed tool", () => {
    it("returns map with installed plugins for requested tool", async () => {
      const manifest = makeManifestWithPlugin();
      const repo = makeManifestRepository(manifest);
      const useCase = new ListPlugins(repo, registeredTools());
      const result = await useCase.execute({ toolIds: [TOOL.claude] });
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
      const useCase = new ListPlugins(repo, registeredTools());
      const result = await useCase.execute({ toolIds: [TOOL.claude] });
      expect(result.get(TOOL.claude)).toHaveLength(0);
    });

    it("resolves a request for every tool through the target resolver", async () => {
      const manifest = aManifest().withTool(TOOL.cursor, []).withTool(TOOL.claude, []).build();
      const useCase = new ListPlugins(makeManifestRepository(manifest), registeredTools());
      const result = await useCase.execute({ toolIds: "all" });
      expect([...result.keys()]).toEqual([TOOL.claude, TOOL.cursor]);
    });
  });
});
