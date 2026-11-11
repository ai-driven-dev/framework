import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cursor } from "../../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import { nativeOf } from "../../../testing/plugin-mode.js";

describe("cursor plugins", () => {
  describe("capabilities.plugins", () => {
    it("is native mode", () => {
      expect(cursor.section("plugins").kind).toBe("native");
    });

    it("pluginsDir is empty string (base-relative path prefix)", () => {
      expect(nativeOf(cursor.section("plugins")).pluginOutputDir("x")).toBe("x/");
    });

    it("pluginManifestRelativePath is null (no manifest file written into plugin dir)", () => {
      expect(nativeOf(cursor.section("plugins")).manifestPath()).toBeNull();
    });

    it("installScope is user", () => {
      expect(nativeOf(cursor.section("plugins")).requiresUserScope()).toBe(true);
    });

    it("acceptsHooks is true (Cursor auto-discovers hooks.json at plugin root)", () => {
      expect(cursor.section("plugins").hooksAcceptance().accepts).toBe(true);
    });

    it("acceptsMcp is true (Cursor auto-discovers mcp.json at plugin root)", () => {
      expect(nativeOf(cursor.section("plugins")).mcpFile().accepts).toBe(true);
    });

    it("marketplaceSettings is null", () => {
      expect(nativeOf(cursor.section("plugins")).marketplaceRegistration()).toBeNull();
    });

    it("userPluginsBaseDir returns ~/.cursor/plugins/local resolved from given homedir", () => {
      const result = cursor.section("plugins").userPluginsBaseDir("/home/user");
      expect(result).toBe(join("/home/user", ".cursor", "plugins", "local"));
    });
  });
});
