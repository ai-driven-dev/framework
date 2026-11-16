import { describe, expect, it } from "vitest";
import { copilot } from "../../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";

describe("copilot plugins", () => {
  describe("capabilities.plugins", () => {
    it("has a plugins capability", () => {
      expect("plugins" in copilot.capabilities).toBe(true);
    });

    it("is native mode", () => {
      expect(copilot.capabilities.plugins.mode).toBe("native");
    });

    it("uses .github/plugins/ as plugins directory", () => {
      expect(copilot.capabilities.plugins.pluginsDir).toBe(".github/plugins/");
    });

    it("uses plugin.json as plugin manifest path", () => {
      expect(copilot.capabilities.plugins.pluginManifestRelativePath).toBe("plugin.json");
    });

    it("pluginOutputDir returns correct path for a plugin name", () => {
      expect(copilot.capabilities.plugins.pluginOutputDir("my-plugin")).toBe(
        ".github/plugins/my-plugin/"
      );
    });
  });

  describe("capabilities.plugins.marketplaceSettings", () => {
    const ms = copilot.capabilities.plugins.marketplaceSettings;

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
