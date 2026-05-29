import { describe, expect, it } from "vitest";
import { ModeAMarketplaceTranslator } from "../../../../../src/application/use-cases/plugin/translator/mode-a-marketplace-translator.js";
import { ModeBFlatMaterializationTranslator } from "../../../../../src/application/use-cases/plugin/translator/mode-b-flat-materialization-translator.js";
import { resolveTranslator } from "../../../../../src/application/use-cases/plugin/translator/plugin-translator-factory.js";
import { PluginsCapability } from "../../../../../src/domain/capabilities/plugins-capability.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";

function buildDeps(homedir = "/stub-home") {
  const fs = new InMemoryFileAdapter();
  const hasher = new DeterministicHasher();
  return { fs, hasher, homedir: () => homedir };
}

const MARKETPLACE_SETTINGS = {
  settingsPath: ".claude/settings.json",
  settingsKey: "extraKnownMarketplaces",
  toEntry: () => null,
};

describe("resolveTranslator", () => {
  describe("when translationMode is marketplace", () => {
    it("returns ModeAMarketplaceTranslator", () => {
      const deps = buildDeps();
      const plugins = new PluginsCapability({
        mode: "native",
        pluginsDir: ".claude/plugins/",
        pluginManifestRelativePath: "plugin.json",
        translationMode: "marketplace",
        marketplaceSettings: MARKETPLACE_SETTINGS,
      });
      const adapter = resolveTranslator(plugins, deps);
      expect(adapter).toBeInstanceOf(ModeAMarketplaceTranslator);
      expect(adapter?.mode).toBe("marketplace");
    });
  });

  describe("when translationMode is flat", () => {
    it("returns ModeBFlatMaterializationTranslator", () => {
      const deps = buildDeps();
      const plugins = new PluginsCapability({
        mode: "flat",
        flatNamespacePrefix: "aidd-",
      });
      const adapter = resolveTranslator(plugins, deps);
      expect(adapter).toBeInstanceOf(ModeBFlatMaterializationTranslator);
      expect(adapter?.mode).toBe("flat");
    });
  });

  describe("when translationMode is null (unsupported)", () => {
    it("returns null", () => {
      const deps = buildDeps();
      const plugins = new PluginsCapability({ mode: "unsupported" });
      const adapter = resolveTranslator(plugins, deps);
      expect(adapter).toBeNull();
    });
  });

  describe("when translationMode is null (native without marketplace)", () => {
    it("returns null (neutral native, no translation strategy applies)", () => {
      const deps = buildDeps();
      const plugins = new PluginsCapability({
        mode: "native",
        pluginsDir: ".custom/plugins/",
        pluginManifestRelativePath: "plugin.json",
      });
      const adapter = resolveTranslator(plugins, deps);
      expect(adapter).toBeNull();
    });
  });
});
