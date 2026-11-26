import { describe, expect, it } from "vitest";
import { registeredAiProfile } from "../../../../shared/testing/catalog-of.builder.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

describe("what a project check asks a tool profile", () => {
  describe("whether enabling a plugin acts on the whole machine", () => {
    it("is so for a tool with no native plugin CLI at all", () => {
      expect(registeredAiProfile(TOOL.opencode).pluginEnablementIsMachineGlobal()).toBe(true);
    });
  });

  describe("the marketplaces a tool's settings file declares", () => {
    it("names those listed in the tool's settings key, as a map or as a list", () => {
      const claude = registeredAiProfile(TOOL.claude).marketplaceRegistration();

      expect(
        claude?.declaredMarketplaceNames({ extraKnownMarketplaces: { a: {}, b: {} } })
      ).toStrictEqual(new Set(["a", "b"]));
      expect(
        claude?.declaredMarketplaceNames({ extraKnownMarketplaces: ["a", "b"] })
      ).toStrictEqual(new Set(["a", "b"]));
    });

    it("names none under another key or from a value that is no object", () => {
      const claude = registeredAiProfile(TOOL.claude).marketplaceRegistration();

      expect(claude?.declaredMarketplaceNames({ other: { a: {} } })).toStrictEqual(new Set());
      expect(claude?.declaredMarketplaceNames(null)).toStrictEqual(new Set());
    });
  });

  describe("how a tool registers marketplaces in its shared settings file", () => {
    it("answers the keys under which the declarations and the enabled plugins sit", () => {
      const registration = registeredAiProfile(TOOL.claude).marketplaceRegistration();

      expect([registration?.marketplacesKey(), registration?.enabledPluginsKey()]).toStrictEqual([
        "extraKnownMarketplaces",
        "enabledPlugins",
      ]);
    });
  });
});
