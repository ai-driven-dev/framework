import { describe, expect, it } from "vitest";
import { ModeAMarketplaceAdapter } from "../../../../../src/application/use-cases/plugin/translator/mode-a-marketplace-adapter.js";
import { ModeBFlatMaterializationAdapter } from "../../../../../src/application/use-cases/plugin/translator/mode-b-flat-materialization-adapter.js";
import { resolveTranslationAdapter } from "../../../../../src/application/use-cases/plugin/translator/plugin-translation-adapter-factory.js";
import { PluginsCapability } from "../../../../../src/domain/capabilities/plugins-capability.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";

function buildDeps() {
  const fs = new InMemoryFileAdapter();
  const hasher = new DeterministicHasher();
  return { fs, hasher };
}

const MARKETPLACE_SETTINGS = {
  settingsPath: ".claude/settings.json",
  settingsKey: "extraKnownMarketplaces",
  toEntry: () => null,
};

describe("resolveTranslationAdapter", () => {
  describe("when mode is native and marketplaceSettings is present", () => {
    it("returns ModeAMarketplaceAdapter", () => {
      const deps = buildDeps();
      const plugins = new PluginsCapability({
        mode: "native",
        pluginsDir: ".claude/plugins/",
        pluginManifestRelativePath: "plugin.json",
        marketplaceSettings: MARKETPLACE_SETTINGS,
      });
      const adapter = resolveTranslationAdapter(plugins, deps);
      expect(adapter).toBeInstanceOf(ModeAMarketplaceAdapter);
      expect(adapter?.mode).toBe("marketplace");
    });
  });

  describe("when mode is flat", () => {
    it("returns ModeBFlatMaterializationAdapter", () => {
      const deps = buildDeps();
      const plugins = new PluginsCapability({
        mode: "flat",
        flatNamespacePrefix: "aidd-",
      });
      const adapter = resolveTranslationAdapter(plugins, deps);
      expect(adapter).toBeInstanceOf(ModeBFlatMaterializationAdapter);
      expect(adapter?.mode).toBe("flat");
    });
  });

  describe("when mode is unsupported", () => {
    it("returns null", () => {
      const deps = buildDeps();
      const plugins = new PluginsCapability({ mode: "unsupported" });
      const adapter = resolveTranslationAdapter(plugins, deps);
      expect(adapter).toBeNull();
    });
  });

  describe("when mode is native but marketplaceSettings is null", () => {
    it("returns null (neutral native, no marketplace sync needed)", () => {
      const deps = buildDeps();
      const plugins = new PluginsCapability({
        mode: "native",
        pluginsDir: ".custom/plugins/",
        pluginManifestRelativePath: "plugin.json",
      });
      const adapter = resolveTranslationAdapter(plugins, deps);
      expect(adapter).toBeNull();
    });
  });
});
