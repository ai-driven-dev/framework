import { describe, expect, it } from "vitest";
import { nativeLayout } from "../../../../../src/contexts/tools/domain/sections/layout-section.js";
import { CapabilityConfigError } from "../../../../../src/kernel/errors.js";

const MARKETPLACE_SETTINGS = {
  settingsPath: ".claude/settings.json",
  settingsKey: "extraKnownMarketplaces",
  toEntryKey: () => null,
  marketplacesSettingsPath: null,
};

const ACTIVATION = { binary: "claude", enableVerb: "install", disableVerb: "uninstall" };

describe("a native layout", () => {
  it("refuses a user-scope install without the resolver of its user directory", () => {
    expect(() => nativeLayout({ pluginsDir: "", installScope: "user" })).toThrow(
      "installScope 'user' requires a userPluginsDir resolver function."
    );
  });

  it("refuses marketplace settings its tool has no native activation to drive", () => {
    expect(() =>
      nativeLayout({ pluginsDir: ".x/plugins/", marketplaceSettings: MARKETPLACE_SETTINGS })
    ).toThrow(CapabilityConfigError);
  });

  it("keeps marketplace settings next to the activation that drives them", () => {
    const layout = nativeLayout({
      pluginsDir: ".x/plugins/",
      marketplaceSettings: MARKETPLACE_SETTINGS,
      nativeActivation: ACTIVATION,
    });

    expect([layout.marketplace?.sharedSettingsFile(), layout.activation?.hostBinary()]).toEqual([
      ".claude/settings.json",
      "claude",
    ]);
  });
});
