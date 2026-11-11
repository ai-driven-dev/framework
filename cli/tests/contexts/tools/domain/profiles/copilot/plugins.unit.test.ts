import { describe, expect, it } from "vitest";
import { copilot } from "../../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";

describe("copilot plugins", () => {
  describe("capabilities.plugins", () => {
    it("is native mode", () => {
      expect(copilot.section("plugins").isNative()).toBe(true);
    });

    it("uses .github/plugins/ as plugins directory", () => {
      expect(copilot.section("plugins").projectPluginsDir()).toBe(".github/plugins/");
    });

    it("uses plugin.json as plugin manifest path", () => {
      expect(copilot.section("plugins").manifestPath()).toBe("plugin.json");
    });

    it("pluginOutputDir returns correct path for a plugin name", () => {
      expect(copilot.section("plugins").pluginOutputDir("my-plugin")).toBe(
        ".github/plugins/my-plugin/"
      );
    });
  });

  describe("capabilities.plugins.marketplaceSettings", () => {
    const ms = copilot.section("plugins").marketplaceRegistration();

    it("has marketplaceSettings configured", () => {
      expect(ms).not.toBeNull();
    });

    it("writes to .github/copilot/settings.json", () => {
      expect(ms?.settingsPath).toBe(".github/copilot/settings.json");
    });

    it("uses extraKnownMarketplaces as settings key", () => {
      expect(ms?.settingsKey).toBe("extraKnownMarketplaces");
    });

    it("uses enabledPlugins as enabled plugins key", () => {
      expect(ms?.enabledPluginsKey).toBe("enabledPlugins");
    });

    describe("the key a marketplace is recorded under", () => {
      it("keys a github marketplace by its name", () => {
        expect(
          ms?.toEntryKey({
            name: "aidd-framework",
            source: { kind: "github", repo: "ai-driven-dev/framework" },
          })
        ).toBe("aidd-framework");
      });

      it("keys a local marketplace by its name too — the source decides only whether there is a key", () => {
        expect(
          ms?.toEntryKey({ name: "my-marketplace", source: { kind: "local", path: "/dev/aidd" } })
        ).toBe("my-marketplace");
      });

      it("returns null for unsupported source kind (npm)", () => {
        const result = ms?.toEntryKey({
          name: "my-plugin",
          source: { kind: "npm", package: "my-plugin" },
        });
        expect(result).toBeNull();
      });

      it("returns null for unsupported source kind (url)", () => {
        const result = ms?.toEntryKey({
          name: "my-plugin",
          source: { kind: "url", url: "https://example.com/plugin.zip" },
        });
        expect(result).toBeNull();
      });
    });
  });
});
