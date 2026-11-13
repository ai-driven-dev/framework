import { describe, expect, it } from "vitest";
import {
  flatGlobalFilePath,
  nativeLayout,
} from "../../../../../src/contexts/tools/domain/sections/layout-section.js";
import { CapabilityConfigError } from "../../../../../src/shared/domain/errors.js";

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

describe("the global files a flat tool maps to its user directory", () => {
  const plugin = { name: "p", agents: new Set(["a"]) };
  const map = flatGlobalFilePath(".x/");
  const mapped = (builtPath: string) => map(builtPath, plugin);

  it("keeps a plugin's skills and its own agents below the directory", () => {
    expect([mapped(".x/skills/p/SKILL.md"), mapped(".x/agents/p-a.md")]).toEqual([
      "skills/p/SKILL.md",
      "agents/p-a.md",
    ]);
  });

  it("maps nothing outside the directory", () => {
    expect(mapped(".y/skills/p/SKILL.md")).toBeNull();
  });

  it("maps an agent only when it sits directly under agents and ends in .md", () => {
    expect([mapped(".x/nested/agents/p-a.md"), mapped(".x/agents/p-a.md.bak")]).toEqual([
      null,
      null,
    ]);
  });

  it("maps only agents prefixed with the plugin's name", () => {
    expect(mapped(".x/agents/q-a.md")).toBeNull();
  });
});

describe("a native layout's scope", () => {
  it("installs at project scope unless told otherwise", () => {
    expect(nativeLayout({ pluginsDir: ".x/" }).installScope).toBe("project");
  });
});
