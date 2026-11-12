import { describe, expect, it } from "vitest";
import { registeredAiProfile } from "../../testing/catalog-of.js";

describe("what a project check asks a tool profile", () => {
  describe("whether enabling a plugin acts on the whole machine", () => {
    it("is so for a tool with no native plugin CLI at all", () => {
      expect(registeredAiProfile("opencode").pluginEnablementIsMachineGlobal()).toBe(true);
    });
  });

  describe("the marketplaces a tool's settings file declares", () => {
    it("names those listed in the tool's settings key, as a map or as a list", () => {
      const claude = registeredAiProfile("claude").marketplaceRegistration();

      expect(
        claude?.declaredMarketplaceNames({ extraKnownMarketplaces: { a: {}, b: {} } })
      ).toStrictEqual(new Set(["a", "b"]));
      expect(
        claude?.declaredMarketplaceNames({ extraKnownMarketplaces: ["a", "b"] })
      ).toStrictEqual(new Set(["a", "b"]));
    });

    it("names none under another key or from a value that is no object", () => {
      const claude = registeredAiProfile("claude").marketplaceRegistration();

      expect(claude?.declaredMarketplaceNames({ other: { a: {} } })).toStrictEqual(new Set());
      expect(claude?.declaredMarketplaceNames(null)).toStrictEqual(new Set());
    });
  });

  describe("how a tool registers marketplaces in its shared settings file", () => {
    it("answers a copy of a parsed shared file with the plugins enabled", () => {
      const registration = registeredAiProfile("claude").marketplaceRegistration();
      const shared: Record<string, unknown> = {};

      expect(registration?.withEnabledPlugins(shared, ["p@m"])).toStrictEqual({
        enabledPlugins: { "p@m": true },
      });
      expect(shared).toStrictEqual({});
    });

    it("answers a copy without the marketplaces declaration, or null when there was none", () => {
      const registration = registeredAiProfile("claude").marketplaceRegistration();
      const shared: Record<string, unknown> = { extraKnownMarketplaces: {}, keep: 1 };

      expect(registration?.withoutMarketplaces(shared)).toStrictEqual({ keep: 1 });
      expect(shared).toStrictEqual({ extraKnownMarketplaces: {}, keep: 1 });
      expect(registration?.withoutMarketplaces({ keep: 1 })).toBeNull();
    });
  });
});
