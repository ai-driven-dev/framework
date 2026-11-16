import { describe, expect, it } from "vitest";
import { BuiltTreeMaterializationTranslator } from "../../../../../src/contexts/installation/application/materialize/built-tree-materialization-translator.js";
import { ModeAMarketplaceTranslator } from "../../../../../src/contexts/installation/application/materialize/mode-a-marketplace-translator.js";
import { resolveTranslator } from "../../../../../src/contexts/installation/application/materialize/plugin-translator-factory.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { fakeBuiltDeps } from "../../../../helpers/ports/fake-build-sources.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import {
  answersOf,
  nativePlugins,
  unsupportedPlugins,
} from "../../../tools/testing/plugin-mode.js";

function buildDeps(homedir = "/stub-home") {
  const fs = new InMemoryFileAdapter();
  const hasher = new DeterministicHasher();
  return {
    fs,
    hasher,
    built: { ...fakeBuiltDeps(), homedir: () => homedir },
  };
}

const MARKETPLACE_SETTINGS = {
  settingsPath: ".claude/settings.json",
  settingsKey: "extraKnownMarketplaces",
  toEntryKey: () => null,
  marketplacesSettingsPath: null,
};

describe("resolveTranslator", () => {
  describe("when translationMode is marketplace", () => {
    it("returns ModeAMarketplaceTranslator", () => {
      const deps = buildDeps();
      const plugins = answersOf(
        nativePlugins({
          pluginRootToken: "$X_PLUGIN_ROOT",
          pluginsDir: ".claude/plugins/",
          manifestRelativePath: "plugin.json",
          translationMode: "marketplace",
          marketplaceSettings: MARKETPLACE_SETTINGS,
          nativeActivation: { binary: "claude", enableVerb: "install", disableVerb: "uninstall" },
        })
      );
      const adapter = resolveTranslator(plugins, deps);
      expect(adapter).toBeInstanceOf(ModeAMarketplaceTranslator);
      expect(adapter?.mode).toBe("marketplace");
    });
  });

  describe("when installScope is user", () => {
    it("returns BuiltTreeMaterializationTranslator", () => {
      const deps = buildDeps();
      const plugins = answersOf(
        nativePlugins({
          pluginRootToken: "$X_PLUGIN_ROOT",
          pluginsDir: "",
          manifestRelativePath: null,
          installScope: "user",
          userPluginsDir: (h) => `${h}/.cursor/plugins/local`,
        })
      );
      const adapter = resolveTranslator(plugins, deps);
      expect(adapter).toBeInstanceOf(BuiltTreeMaterializationTranslator);
      expect(adapter?.mode).toBe("flat");
    });
  });

  describe("when translationMode is null (unsupported)", () => {
    it("returns null", () => {
      const deps = buildDeps();
      const plugins = answersOf(unsupportedPlugins());
      const adapter = resolveTranslator(plugins, deps);
      expect(adapter).toBeNull();
    });
  });

  describe("when translationMode is null (native without marketplace)", () => {
    it("returns null (neutral native, no translation strategy applies)", () => {
      const deps = buildDeps();
      const plugins = answersOf(
        nativePlugins({
          pluginRootToken: "$X_PLUGIN_ROOT",
          pluginsDir: ".custom/plugins/",
          manifestRelativePath: "plugin.json",
        })
      );
      const adapter = resolveTranslator(plugins, deps);
      expect(adapter).toBeNull();
    });
  });
});
