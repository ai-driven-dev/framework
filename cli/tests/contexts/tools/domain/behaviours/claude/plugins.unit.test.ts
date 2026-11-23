import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/composition/tool-profiles/claude.js";
import { registeredAiConfig } from "../../../../../shared/testing/catalog-of.builder.js";
import { nativeOf } from "../../../../../shared/testing/native-plugin-answers.builder.js";
import { TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

describe("claude plugins", () => {
  describe("with Claude's plugins capability", () => {
    it("is native mode", () => {
      expect(claude.plugins()?.kind).toBe("native");
    });

    it("uses .claude/plugins/ as plugins directory", () => {
      expect(nativeOf(claude.plugins()).pluginOutputDir("x")).toBe(".claude/plugins/x/");
    });

    it("uses plugin.json as plugin manifest path", () => {
      expect(nativeOf(claude.plugins()).manifestPath()).toBe("plugin.json");
    });

    it("pluginOutputDir returns correct path for a plugin name", () => {
      expect(nativeOf(claude.plugins()).pluginOutputDir("my-plugin")).toBe(
        ".claude/plugins/my-plugin/"
      );
    });

    it("declares its own marketplace registry and plugin cache root, for clean's own purge", () => {
      const activation = registeredAiConfig(TOOL.claude).nativeActivation();
      expect(activation?.marketplaceRegistryAt("/home/tester")?.path).toBe(
        join("/home/tester", ".claude", "plugins", "known_marketplaces.json")
      );
      expect(activation?.pluginCacheRoot("/home/tester")).toBe(
        join("/home/tester", ".claude", "plugins", "cache")
      );
    });

    it("declares where claude's own user-scope settings file lives, for --scope user", () => {
      const activation = registeredAiConfig(TOOL.claude).nativeActivation();
      expect(activation?.userSettingsFile("/home/tester", () => undefined)).toBe(
        join("/home/tester", ".claude", "settings.json")
      );
    });

    it("drives the claude binary at local scope, with the verbs claude uses and nothing else", () => {
      const activation = registeredAiConfig(TOOL.claude).nativeActivation();
      // Exhaustive, not `toMatchObject`: a verb added by mistake must fail here.
      expect(activation?.hostBinary()).toBe("claude");
      expect(activation?.cliShape()).toEqual({
        scopeArgs: { project: ["--scope", "local"], user: ["--scope", "user"] },
        userRemoveArgs: [],
        enableVerb: "install",
        disableVerb: "uninstall",
        upgradeVerb: "update",
        pluginArgs: ["--yes"],
      });
      expect(activation?.marketplaceRegistryAt("/home/tester")?.layout).toBe(
        "install-locations-by-name"
      );
      expect(activation?.marketplaceSourcesDeclaration()).toStrictEqual({
        from: "marketplace-registry",
      });
      expect(activation?.pluginRegistryAt("/home/tester")?.layout).toBe("plugin-entries-by-scope");
    });

    it("registers a marketplace in the file claude writes itself, and enables plugins in the tracked one", () => {
      const settings = registeredAiConfig(TOOL.claude).marketplaceRegistration();

      expect({
        settingsPath: settings?.sharedSettingsFile(),
        settingsKey: settings?.marketplacesKey(),
        marketplacesSettingsPath: settings?.machineLocalFiles()[0] ?? null,
        enabledPluginsKey: settings?.enabledPluginsKey(),
        entryKey: settings?.entryKeyFor({
          name: "aidd-framework",
          source: { kind: "local", path: "/abs/cache" },
        }),
      }).toStrictEqual({
        settingsPath: ".claude/settings.json",
        settingsKey: "extraKnownMarketplaces",
        marketplacesSettingsPath: ".claude/settings.local.json",
        enabledPluginsKey: "enabledPlugins",
        entryKey: "aidd-framework",
      });
    });
  });
});
