import { describe, expect, it } from "vitest";
import type { ProjectHooksFormat } from "../../../../../src/contexts/tools/domain/plugins/plugin-params.js";
import { pluginsCapability } from "../../../../../src/contexts/tools/domain/plugins/plugins-capability.js";
import { CapabilityConfigError } from "../../../../../src/kernel/errors.js";
import { flatOf, nativeOf, pluginModeOf } from "../../testing/plugin-mode.js";

const projectHooksFormat: ProjectHooksFormat = {
  merge: () => ({ content: "", warnings: [] }),
  unmerge: () => "",
  contributedEntries: () => [],
  isEmpty: () => true,
  scriptPath: () => "",
  scriptDir: () => "",
};

const MARKETPLACE_SETTINGS = {
  settingsPath: ".claude/settings.json",
  settingsKey: "extraKnownMarketplaces",
  toEntryKey: () => null,
  marketplacesSettingsPath: null,
};

describe("PluginsCapability", () => {
  describe("native mode", () => {
    const cap = pluginsCapability({
      mode: "native",
      pluginRootToken: "$X_PLUGIN_ROOT",
      acceptsHooks: true,
      pluginsDir: ".claude/plugins/",
      pluginManifestRelativePath: ".claude-plugin/plugin.json",
    });

    it("exposes mode as native", () => {
      expect(pluginModeOf(cap)).toBe("native");
    });

    it("exposes pluginsDir", () => {
      expect(nativeOf(cap).pluginOutputDir("x")).toBe(".claude/plugins/x/");
    });

    it("exposes pluginManifestRelativePath", () => {
      expect(nativeOf(cap).manifestPath()).toBe(".claude-plugin/plugin.json");
    });

    it("pluginOutputDir returns the plugin subdirectory", () => {
      expect(nativeOf(cap).pluginOutputDir("my-plugin")).toBe(".claude/plugins/my-plugin/");
    });
  });

  describe("flat mode, hooks unsupported", () => {
    const cap = pluginsCapability({
      mode: "flat",
      acceptsHooks: false,
      hooksUnsupportedReason: "a test double that hosts no plugin directory",
      flatNamespacePrefix: "aidd-",
    });

    it("exposes mode as flat", () => {
      expect(pluginModeOf(cap)).toBe("flat");
    });

    it("exposes flatNamespacePrefix", () => {
      expect(flatOf(cap).flatLayout().namespacePrefix).toBe("aidd-");
    });

    it("exposes hooksUnsupportedReason", () => {
      expect(cap.hooksAcceptance()).toStrictEqual({
        accepts: false,
        reason: "a test double that hosts no plugin directory",
      });
    });
  });

  describe("flat mode, hooks accepted", () => {
    const cap = pluginsCapability({
      mode: "flat",
      acceptsHooks: true,
      flatHooksDir: ".test-tool/plugin/",
      flatNamespacePrefix: "aidd-",
    });

    it("acceptsHooks is true", () => {
      expect(cap.hooksAcceptance().accepts).toBe(true);
    });

    it("exposes flatHooksDir", () => {
      expect(flatOf(cap).flatLayout().hooksDir).toBe(".test-tool/plugin/");
    });

    it("states no reason when hooks are accepted", () => {
      expect(cap.hooksAcceptance()).toStrictEqual({ accepts: true });
    });

    it("flatHooksLoaderEntry is null when not declared", () => {
      expect(flatOf(cap).flatLayout().hooksLoaderEntry).toBeNull();
    });
  });

  describe("flat mode, hooks accepted, with a loader entry", () => {
    const cap = pluginsCapability({
      mode: "flat",
      acceptsHooks: true,
      flatHooksDir: ".test-tool/hooks/",
      flatHooksLoaderEntry: { dir: ".test-tool/plugin/", baseName: "test-tool-plugin.js" },
      flatNamespacePrefix: "aidd-",
    });

    it("exposes flatHooksLoaderEntry", () => {
      expect(flatOf(cap).flatLayout().hooksLoaderEntry).toEqual({
        dir: ".test-tool/plugin/",
        baseName: "test-tool-plugin.js",
      });
    });
  });

  describe("unsupported mode", () => {
    const cap = pluginsCapability({
      mode: "unsupported",
      hooksUnsupportedReason: "a test double that hosts no plugin directory",
    });

    it("exposes mode as unsupported", () => {
      expect(pluginModeOf(cap)).toBe("unsupported");
    });
  });

  describe("user scope (native mode)", () => {
    const cap = pluginsCapability({
      mode: "native",
      pluginRootToken: "$X_PLUGIN_ROOT",
      acceptsHooks: true,
      pluginsDir: "",
      pluginManifestRelativePath: null,
      installScope: "user",
      userPluginsDir: (h) => `${h}/.cursor/plugins/local`,
    });

    it("exposes installScope as user", () => {
      expect(nativeOf(cap).requiresUserScope()).toBe(true);
    });

    it("userPluginsBaseDir returns homedir-based path", () => {
      expect(cap.userPluginsBaseDir("/home/user")).toBe("/home/user/.cursor/plugins/local");
    });
  });

  describe("project scope (default)", () => {
    const cap = pluginsCapability({
      mode: "native",
      pluginRootToken: "$X_PLUGIN_ROOT",
      acceptsHooks: true,
      pluginsDir: ".claude/plugins/",
      pluginManifestRelativePath: "plugin.json",
    });

    it("exposes installScope as project", () => {
      expect(nativeOf(cap).requiresUserScope()).toBe(false);
    });
  });

  describe("user scope without userPluginsDir resolver", () => {
    it("throws CapabilityConfigError", () => {
      expect(() =>
        pluginsCapability({
          mode: "native",
          pluginRootToken: "$X_PLUGIN_ROOT",
          acceptsHooks: true,
          pluginsDir: "",
          pluginManifestRelativePath: null,
          installScope: "user",
        })
      ).toThrow("installScope 'user' requires a userPluginsDir resolver function.");
    });
  });

  describe("translationMode", () => {
    describe("native with marketplaceSettings and translationMode marketplace", () => {
      it("exposes translationMode as marketplace", () => {
        const cap = pluginsCapability({
          mode: "native",
          pluginRootToken: "$X_PLUGIN_ROOT",
          acceptsHooks: true,
          pluginsDir: ".claude/plugins/",
          pluginManifestRelativePath: "plugin.json",
          translationMode: "marketplace",
          marketplaceSettings: MARKETPLACE_SETTINGS,
          nativeActivation: { binary: "claude", enableVerb: "install", disableVerb: "uninstall" },
        });
        expect(nativeOf(cap).translatesAsMarketplace()).toBe(true);
      });
    });

    describe("native without translationMode", () => {
      it("builds as a marketplace without declaring it (neutral native)", () => {
        const cap = pluginsCapability({
          mode: "native",
          pluginRootToken: "$X_PLUGIN_ROOT",
          acceptsHooks: true,
          pluginsDir: ".claude/plugins/",
          pluginManifestRelativePath: "plugin.json",
        });
        expect([nativeOf(cap).translatesAsMarketplace(), cap.kind]).toStrictEqual([
          false,
          "native",
        ]);
      });
    });
  });
});

describe("PluginsCapability base directory resolution", () => {
  const native = {
    mode: "native" as const,
    pluginRootToken: "$X_PLUGIN_ROOT",
    acceptsHooks: true as const,
    pluginsDir: ".x/plugins/",
    pluginManifestRelativePath: null,
  };

  it("answers a declared user directory even when the scope is project", () => {
    const cap = pluginsCapability({
      ...native,
      userPluginsDir: (home) => `${home}/.x/plugins`,
    });

    expect(nativeOf(cap).requiresUserScope()).toBe(false);
    expect(cap.userPluginsBaseDir("/home/me")).toBe("/home/me/.x/plugins");
  });

  it("answers no user directory for a capability declaring none", () => {
    const cap = pluginsCapability(native);

    expect(cap.userPluginsBaseDir("/home/me")).toBeNull();
  });

  it("names a plugin's own directory under the plugins directory in native mode", () => {
    expect(nativeOf(pluginsCapability(native)).pluginOutputDir("p")).toBe(".x/plugins/p/");
  });

  it("refuses a project hooks destination that names no project hooks file", () => {
    expect(() => pluginsCapability({ ...native, hooksDestination: "project" })).toThrow(
      "hooksDestination 'project' requires a projectHooksRelativePath."
    );
  });

  it("refuses a project hooks destination that declares no file format", () => {
    expect(() =>
      pluginsCapability({
        ...native,
        hooksDestination: "project",
        projectHooksRelativePath: ".x/hooks.json",
      })
    ).toThrow("hooksDestination 'project' requires a projectHooksFormat.");
  });

  it("refuses a project hooks format without a project hooks destination", () => {
    expect(() => pluginsCapability({ ...native, projectHooksFormat: projectHooksFormat })).toThrow(
      "projectHooksFormat requires hooksDestination 'project'."
    );
  });

  it("lets a flat capability merge its hooks into a project hooks file", () => {
    const cap = pluginsCapability({
      mode: "flat",
      acceptsHooks: true,
      flatHooksDir: ".x/hooks/",
      flatNamespacePrefix: "aidd-",
      hooksDestination: "project",
      projectHooksRelativePath: ".x/hooks.json",
      projectHooksFormat: projectHooksFormat,
    });

    expect(cap.deliversHooksToProject()).toBe(true);
    expect(cap.projectHooksDelivery()?.relativePath).toBe(".x/hooks.json");
    expect(cap.projectHooksDelivery()?.format).toBe(projectHooksFormat);
  });
});

describe("PluginsCapability defaults each mode falls back to", () => {
  it("delivers no mcp and lands hooks in the plugin unless a native tool says otherwise", () => {
    const cap = pluginsCapability({
      mode: "native",
      pluginRootToken: "$X_PLUGIN_ROOT",
      acceptsHooks: true,
      pluginsDir: ".x/plugins/",
      pluginManifestRelativePath: null,
    });

    expect([nativeOf(cap).mcpFile().accepts, cap.deliversHooksToProject()]).toStrictEqual([
      false,
      false,
    ]);
  });

  it("lands a flat tool's hooks in the plugin", () => {
    const cap = pluginsCapability({
      mode: "flat",
      acceptsHooks: true,
      flatHooksDir: ".x/hooks/",
      flatNamespacePrefix: "aidd-",
    });

    expect(cap.deliversHooksToProject()).toBe(false);
  });

  it("accepts no hooks for a tool hosting no plugin at all", () => {
    const cap = pluginsCapability({ mode: "unsupported", hooksUnsupportedReason: "none" });

    expect([cap.hooksAcceptance().accepts, cap.deliversHooksToProject()]).toStrictEqual([
      false,
      false,
    ]);
  });
});

describe("PluginsCapability native construction", () => {
  const native = {
    mode: "native" as const,
    acceptsHooks: true as const,
    pluginsDir: ".x/plugins/",
    pluginManifestRelativePath: "plugin.json",
    pluginRootToken: "$X_PLUGIN_ROOT",
  };

  it("does not compile without the plugin root token", () => {
    const { pluginRootToken: _omitted, ...withoutToken } = native;

    // @ts-expect-error pluginRootToken is required on a native capability
    const cap = pluginsCapability(withoutToken);

    expect(pluginModeOf(cap)).toBe("native");
  });

  it("refuses marketplace settings its tool has no native activation to drive", () => {
    expect(() =>
      pluginsCapability({ ...native, marketplaceSettings: MARKETPLACE_SETTINGS })
    ).toThrow(CapabilityConfigError);
  });

  it("keeps marketplace settings next to the activation that drives them", () => {
    const cap = pluginsCapability({
      ...native,
      marketplaceSettings: MARKETPLACE_SETTINGS,
      nativeActivation: { binary: "claude", enableVerb: "install", disableVerb: "uninstall" },
    });
    expect([
      nativeOf(cap).marketplaceRegistration()?.settingsPath,
      nativeOf(cap).activation()?.binary,
    ]).toEqual([".claude/settings.json", "claude"]);
  });
});
