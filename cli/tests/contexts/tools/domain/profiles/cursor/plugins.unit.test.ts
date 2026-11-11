import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cursor } from "../../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";

describe("cursor plugins", () => {
  describe("capabilities.plugins", () => {
    it("is native mode", () => {
      expect(cursor.section("plugins").isNative()).toBe(true);
    });

    it("pluginsDir is empty string (base-relative path prefix)", () => {
      expect(cursor.section("plugins").projectPluginsDir()).toBe("");
    });

    it("pluginManifestRelativePath is null (no manifest file written into plugin dir)", () => {
      expect(cursor.section("plugins").manifestPath()).toBeNull();
    });

    it("installScope is user", () => {
      expect(cursor.section("plugins").requiresUserScope()).toBe(true);
    });

    it("acceptsHooks is true (Cursor auto-discovers hooks.json at plugin root)", () => {
      expect(cursor.section("plugins").hooksAcceptance().accepts).toBe(true);
    });

    it("acceptsMcp is true (Cursor auto-discovers mcp.json at plugin root)", () => {
      expect(cursor.section("plugins").mcpFile().accepts).toBe(true);
    });

    it("marketplaceSettings is null", () => {
      expect(cursor.section("plugins").marketplaceRegistration()).toBeNull();
    });

    it("resolvePluginsBaseDir returns ~/.cursor/plugins/local resolved from given homedir", () => {
      const result = cursor.section("plugins").resolvePluginsBaseDir("/proj", "/home/user");
      expect(result).toBe(join("/home/user", ".cursor", "plugins", "local"));
    });
  });
});
