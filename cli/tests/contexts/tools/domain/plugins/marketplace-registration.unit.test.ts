import { describe, expect, it } from "vitest";
import { MarketplaceRegistration } from "../../../../../src/contexts/tools/domain/plugins/marketplace-registration.js";
import { NativeActivation } from "../../../../../src/contexts/tools/domain/plugins/native-activation.js";
import { CapabilityConfigError } from "../../../../../src/kernel/errors.js";

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
    expect(registration.settingsPath).toBe(".claude/settings.json");
    expect(registration.settingsKey).toBe("extraKnownMarketplaces");
    expect(registration.marketplacesSettingsPath).toBeNull();
    expect(registration.enabledPluginsKey).toBeUndefined();
    expect(registration.toEntryKey({ name: "m", source: { kind: "github", repo: "a/b" } })).toBe(
      "entry"
    );
  });

  it("refuses a registration the tool has no native activation to drive", () => {
    expect(() => new MarketplaceRegistration(settings, null)).toThrow(CapabilityConfigError);
  });
});
