import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import { nativeOf } from "../../../testing/plugin-mode.js";

describe("claude plugins", () => {
  describe("capabilities.plugins", () => {
    it("is native mode", () => {
      expect(claude.section("plugins").kind).toBe("native");
    });

    it("uses .claude/plugins/ as plugins directory", () => {
      expect(nativeOf(claude.section("plugins")).pluginOutputDir("x")).toBe(".claude/plugins/x/");
    });

    it("uses plugin.json as plugin manifest path", () => {
      expect(nativeOf(claude.section("plugins")).manifestPath()).toBe("plugin.json");
    });

    it("pluginOutputDir returns correct path for a plugin name", () => {
      expect(nativeOf(claude.section("plugins")).pluginOutputDir("my-plugin")).toBe(
        ".claude/plugins/my-plugin/"
      );
    });

    it("declares its own marketplace registry and plugin cache root, for clean's own purge", () => {
      const activation = nativeOf(claude.section("plugins")).activation();
      expect(activation?.marketplaceRegistry?.("/home/tester")).toBe(
        join("/home/tester", ".claude", "plugins", "known_marketplaces.json")
      );
      expect(activation?.pluginCacheDir?.("/home/tester")).toBe(
        join("/home/tester", ".claude", "plugins", "cache")
      );
    });

    it("declares where claude's own user-scope settings file lives, for --scope user", () => {
      const activation = nativeOf(claude.section("plugins")).activation();
      expect(activation?.userSettingsPath?.("/home/tester", () => undefined)).toBe(
        join("/home/tester", ".claude", "settings.json")
      );
    });

    it("drives the claude binary at local scope, with the verbs claude uses and nothing else", () => {
      // Exhaustive, not `toMatchObject`: a field added by mistake must fail here.
      expect({ ...nativeOf(claude.section("plugins")).activation() }).toEqual({
        binary: "claude",
        scopeArgs: { project: ["--scope", "local"], user: ["--scope", "user"] },
        userRemoveArgs: [],
        enableVerb: "install",
        disableVerb: "uninstall",
        upgradeVerb: "update",
        pluginArgs: ["--yes"],
        marketplaceRegistry: expect.any(Function),
        pluginCacheDir: expect.any(Function),
        userSettingsPath: expect.any(Function),
      });
    });

    it("registers a marketplace in the file claude writes itself, and enables plugins in the tracked one", () => {
      const settings = nativeOf(claude.section("plugins")).marketplaceRegistration();

      expect({
        settingsPath: settings?.settingsPath,
        settingsKey: settings?.settingsKey,
        marketplacesSettingsPath: settings?.marketplacesSettingsPath,
        enabledPluginsKey: settings?.enabledPluginsKey,
        entryKey: settings?.toEntryKey?.({
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
