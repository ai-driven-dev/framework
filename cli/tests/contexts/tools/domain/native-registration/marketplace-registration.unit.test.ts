import { describe, expect, it } from "vitest";
import { MarketplaceRegistration } from "../../../../../src/contexts/tools/domain/native-registration/marketplace-registration.js";
import { NativeActivation } from "../../../../../src/contexts/tools/domain/native-registration/native-activation.js";
import { CapabilityConfigError } from "../../../../../src/shared/domain/errors.js";
import { keyAskedOf } from "../../../../helpers/settings-key-probe.js";

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
    expect(keyAskedOf((shared) => registration.withoutMarketplaces(shared))).toBe(
      "extraKnownMarketplaces"
    );
    expect(registration.machineLocalFiles()).toEqual([]);
    expect(registration.entryKeyFor({ name: "m", source: { kind: "github", repo: "a/b" } })).toBe(
      "entry"
    );
  });

  describe("the marketplaces declaration of a parsed shared file", () => {
    it("is taken out of a copy, the file the caller holds left as it was", () => {
      const registration = new MarketplaceRegistration(settings, activation);
      const shared = { extraKnownMarketplaces: { a: {} }, keep: 1 };

      expect(registration.withoutMarketplaces(shared)).toStrictEqual({ keep: 1 });
      expect(shared).toStrictEqual({ extraKnownMarketplaces: { a: {} }, keep: 1 });
    });

    it("answers null when the file declares none", () => {
      const registration = new MarketplaceRegistration(settings, activation);

      expect(registration.withoutMarketplaces({ keep: 1 })).toBeNull();
    });
  });

  describe("the plugins a parsed shared file enables", () => {
    const enabling = { ...settings, enabledPluginsKey: "enabledPlugins" };

    it("adds the refs not yet enabled to a copy, the file the caller holds left as it was", () => {
      const registration = new MarketplaceRegistration(enabling, activation);
      const shared = { enabledPlugins: { "old@m": false }, keep: 1 };

      expect(registration.withEnabledPlugins(shared, ["old@m", "new@m"])).toStrictEqual({
        enabledPlugins: { "old@m": false, "new@m": true },
        keep: 1,
      });
      expect(shared).toStrictEqual({ enabledPlugins: { "old@m": false }, keep: 1 });
    });

    it("replaces an enabled-plugins value that is no map", () => {
      const registration = new MarketplaceRegistration(enabling, activation);

      expect(registration.withEnabledPlugins({ enabledPlugins: ["x"] }, ["new@m"])).toStrictEqual({
        enabledPlugins: { "new@m": true },
      });
    });

    it("answers null when every ref is already enabled", () => {
      const registration = new MarketplaceRegistration(enabling, activation);

      expect(
        registration.withEnabledPlugins({ enabledPlugins: { "a@m": true } }, ["a@m"])
      ).toBeNull();
    });

    it("answers null for a tool that enables no plugin in the shared file", () => {
      const registration = new MarketplaceRegistration(settings, activation);

      expect(registration.withEnabledPlugins({}, ["new@m"])).toBeNull();
    });
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
      "marketplaceSettings requires a nativeActivation to drive the registration."
    );
  });

  describe("withEnabledPlugins over a non-map enabled value", () => {
    const registration = new MarketplaceRegistration(
      { ...settings, enabledPluginsKey: "enabledPlugins" },
      activation
    );

    it("starts from an empty map when the value is null", () => {
      expect(registration.withEnabledPlugins({ enabledPlugins: null }, ["p"])).toStrictEqual({
        enabledPlugins: { p: true },
      });
    });

    it("starts from an empty map when the value is a list", () => {
      expect(registration.withEnabledPlugins({ enabledPlugins: ["x"] }, ["p"])).toStrictEqual({
        enabledPlugins: { p: true },
      });
    });
  });
});
