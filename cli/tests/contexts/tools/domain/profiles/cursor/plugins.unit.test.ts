import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cursor } from "../../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";

describe("cursor plugins", () => {
  describe("capabilities.plugins", () => {
    it("has a plugins capability", () => {
      expect("plugins" in cursor.capabilities).toBe(true);
    });

    it("is native mode", () => {
      expect(cursor.capabilities.plugins.mode).toBe("native");
    });

    it("pluginsDir is empty string (base-relative path prefix)", () => {
      expect(cursor.capabilities.plugins.pluginsDir).toBe("");
    });

    it("pluginManifestRelativePath is null (no manifest file written into plugin dir)", () => {
      expect(cursor.capabilities.plugins.pluginManifestRelativePath).toBeNull();
    });

    it("installScope is user", () => {
      expect(cursor.capabilities.plugins.installScope).toBe("user");
    });

    it("acceptsHooks is true (Cursor auto-discovers hooks.json at plugin root)", () => {
      expect(cursor.capabilities.plugins.acceptsHooks).toBe(true);
    });

    it("acceptsMcp is true (Cursor auto-discovers mcp.json at plugin root)", () => {
      expect(cursor.capabilities.plugins.acceptsMcp).toBe(true);
    });

    it("marketplaceSettings is null", () => {
      expect(cursor.capabilities.plugins.marketplaceSettings).toBeNull();
    });

    it("resolvePluginsBaseDir returns ~/.cursor/plugins/local resolved from given homedir", () => {
      const result = cursor.capabilities.plugins.resolvePluginsBaseDir("/proj", "/home/user");
      expect(result).toBe(join("/home/user", ".cursor", "plugins", "local"));
    });
  });
});
