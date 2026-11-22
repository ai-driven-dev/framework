import { describe, expect, it } from "vitest";
import { MarketplaceRegistration } from "../../../../../src/contexts/tools/domain/native-registration/marketplace-registration.js";
import { NativeActivation } from "../../../../../src/contexts/tools/domain/native-registration/native-activation.js";
import { CapabilityConfigError } from "../../../../../src/contexts/tools/domain/tools.error.js";

const settings = {
  settingsPath: ".claude/settings.json",
  settingsKey: "extraKnownMarketplaces",
  marketplacesSettingsPath: null,
  toEntryKey: () => "entry",
};
const activation = new NativeActivation({
  binary: "claude",
  enableVerb: "install",
  disableVerb: "uninstall",
});

describe("MarketplaceRegistration", () => {
  it("reads back where and how the tool records its marketplaces", () => {
    const registration = new MarketplaceRegistration(settings, activation);
    expect(registration.sharedSettingsFile()).toBe(".claude/settings.json");
    expect(registration.machineLocalFiles()).toEqual([]);
    expect(registration.entryKeyFor({ name: "m", source: { kind: "github", repo: "a/b" } })).toBe(
      "entry"
    );
  });

  it("answers the keys of its shared file, none for the enabled plugins a tool does not keep there", () => {
    const registration = new MarketplaceRegistration(settings, activation);
    const enabling = new MarketplaceRegistration(
      { ...settings, enabledPluginsKey: "enabledPlugins" },
      activation
    );

    expect(registration.marketplacesKey()).toBe("extraKnownMarketplaces");
    expect(registration.enabledPluginsKey()).toBeNull();
    expect(enabling.enabledPluginsKey()).toBe("enabledPlugins");
  });

  it("refuses a registration the tool has no native activation to drive", () => {
    expect(() => new MarketplaceRegistration(settings, null)).toThrow(CapabilityConfigError);
  });

  describe("declaredMarketplaceNames", () => {
    const registration = new MarketplaceRegistration(settings, activation);

    it("is empty for a file that is not an object", () => {
      expect(registration.declaredMarketplaceNames(null)).toEqual(new Set());
      expect(registration.declaredMarketplaceNames("extraKnownMarketplaces")).toEqual(new Set());
    });

    it("is empty when the declaration is null or a scalar", () => {
      expect(registration.declaredMarketplaceNames({ extraKnownMarketplaces: null })).toEqual(
        new Set()
      );
      expect(registration.declaredMarketplaceNames({ extraKnownMarketplaces: "a" })).toEqual(
        new Set()
      );
    });
  });

  it("refuses to register without a native activation, and says why", () => {
    expect(() => new MarketplaceRegistration(settings, null)).toThrow(
      expect.objectContaining({
        detail: expect.stringContaining(
          "marketplaceSettings requires a nativeActivation to drive the registration."
        ),
      })
    );
  });
});
