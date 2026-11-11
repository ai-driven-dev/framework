import { describe, expect, it } from "vitest";
import type { ProjectHooksFormat } from "../../../../../src/contexts/tools/domain/capabilities/plugins-capability.js";
import { PluginsCapability } from "../../../../../src/contexts/tools/domain/capabilities/plugins-capability.js";
import { CapabilityConfigError } from "../../../../../src/kernel/errors.js";
import { pluginModeOf } from "../../testing/plugin-mode.js";

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
    const cap = new PluginsCapability({
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
      expect(cap.projectPluginsDir()).toBe(".claude/plugins/");
    });

    it("exposes pluginManifestRelativePath", () => {
      expect(cap.manifestPath()).toBe(".claude-plugin/plugin.json");
    });

    it("flatNamespacePrefix is null", () => {
      expect(cap.flatLayout().namespacePrefix).toBeNull();
    });

    it("pluginOutputDir returns the plugin subdirectory", () => {
      expect(cap.pluginOutputDir("my-plugin")).toBe(".claude/plugins/my-plugin/");
    });
  });

  describe("flat mode, hooks unsupported", () => {
    const cap = new PluginsCapability({
      mode: "flat",
      acceptsHooks: false,
      hooksUnsupportedReason: "a test double that hosts no plugin directory",
      flatNamespacePrefix: "aidd-",
    });

    it("exposes mode as flat", () => {
      expect(pluginModeOf(cap)).toBe("flat");
    });

    it("exposes flatNamespacePrefix", () => {
      expect(cap.flatLayout().namespacePrefix).toBe("aidd-");
    });

    it("pluginsDir is null", () => {
      expect(cap.projectPluginsDir()).toBeNull();
    });

    it("pluginManifestRelativePath is null", () => {
      expect(cap.manifestPath()).toBeNull();
    });

    it("pluginOutputDir returns null", () => {
      expect(cap.pluginOutputDir("my-plugin")).toBeNull();
    });

    it("flatHooksDir is null", () => {
      expect(cap.flatLayout().hooksDir).toBeNull();
    });

    it("exposes hooksUnsupportedReason", () => {
      expect(cap.hooksAcceptance().unsupportedReason).toBe(
        "a test double that hosts no plugin directory"
      );
    });
  });

  describe("flat mode, hooks accepted", () => {
    const cap = new PluginsCapability({
      mode: "flat",
      acceptsHooks: true,
      flatHooksDir: ".test-tool/plugin/",
      flatNamespacePrefix: "aidd-",
    });

    it("acceptsHooks is true", () => {
      expect(cap.hooksAcceptance().accepts).toBe(true);
    });

    it("exposes flatHooksDir", () => {
      expect(cap.flatLayout().hooksDir).toBe(".test-tool/plugin/");
    });

    it("hooksUnsupportedReason is null", () => {
      expect(cap.hooksAcceptance().unsupportedReason).toBeNull();
    });

    it("flatHooksLoaderEntry is null when not declared", () => {
      expect(cap.flatLayout().hooksLoaderEntry).toBeNull();
    });
  });

  describe("flat mode, hooks accepted, with a loader entry", () => {
    const cap = new PluginsCapability({
      mode: "flat",
      acceptsHooks: true,
      flatHooksDir: ".test-tool/hooks/",
      flatHooksLoaderEntry: { dir: ".test-tool/plugin/", baseName: "test-tool-plugin.js" },
      flatNamespacePrefix: "aidd-",
    });

    it("exposes flatHooksLoaderEntry", () => {
      expect(cap.flatLayout().hooksLoaderEntry).toEqual({
        dir: ".test-tool/plugin/",
        baseName: "test-tool-plugin.js",
      });
    });
  });

  describe("unsupported mode", () => {
    const cap = new PluginsCapability({
      mode: "unsupported",
      hooksUnsupportedReason: "a test double that hosts no plugin directory",
    });

    it("exposes mode as unsupported", () => {
      expect(pluginModeOf(cap)).toBe("unsupported");
    });

    it("pluginsDir is null", () => {
      expect(cap.projectPluginsDir()).toBeNull();
    });

    it("pluginManifestRelativePath is null", () => {
      expect(cap.manifestPath()).toBeNull();
    });

    it("flatNamespacePrefix is null", () => {
      expect(cap.flatLayout().namespacePrefix).toBeNull();
    });

    it("pluginOutputDir returns null", () => {
      expect(cap.pluginOutputDir("any-plugin")).toBeNull();
    });
  });

  describe("user scope (native mode)", () => {
    const cap = new PluginsCapability({
      mode: "native",
      pluginRootToken: "$X_PLUGIN_ROOT",
      acceptsHooks: true,
      pluginsDir: "",
      pluginManifestRelativePath: null,
      installScope: "user",
      userPluginsDir: (h) => `${h}/.cursor/plugins/local`,
    });

    it("exposes installScope as user", () => {
      expect(cap.requiresUserScope()).toBe(true);
    });

    it("resolvePluginsBaseDir returns homedir-based path", () => {
      expect(cap.resolvePluginsBaseDir("/proj", "/home/user")).toBe(
        "/home/user/.cursor/plugins/local"
      );
    });
  });

  describe("project scope (default)", () => {
    const cap = new PluginsCapability({
      mode: "native",
      pluginRootToken: "$X_PLUGIN_ROOT",
      acceptsHooks: true,
      pluginsDir: ".claude/plugins/",
      pluginManifestRelativePath: "plugin.json",
    });

    it("exposes installScope as project", () => {
      expect(cap.requiresUserScope()).toBe(false);
    });

    it("resolvePluginsBaseDir returns projectRoot", () => {
      expect(cap.resolvePluginsBaseDir("/my-project", "/home/user")).toBe("/my-project");
    });
  });

  describe("user scope without userPluginsDir resolver", () => {
    it("throws CapabilityConfigError", () => {
      expect(
        () =>
          new PluginsCapability({
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
        const cap = new PluginsCapability({
          mode: "native",
          pluginRootToken: "$X_PLUGIN_ROOT",
          acceptsHooks: true,
          pluginsDir: ".claude/plugins/",
          pluginManifestRelativePath: "plugin.json",
          translationMode: "marketplace",
          marketplaceSettings: MARKETPLACE_SETTINGS,
          nativeActivation: { binary: "claude", enableVerb: "install", disableVerb: "uninstall" },
        });
        expect(cap.translatesAsMarketplace()).toBe(true);
      });
    });

    describe("native without translationMode", () => {
      it("builds as a marketplace without declaring it (neutral native)", () => {
        const cap = new PluginsCapability({
          mode: "native",
          pluginRootToken: "$X_PLUGIN_ROOT",
          acceptsHooks: true,
          pluginsDir: ".claude/plugins/",
          pluginManifestRelativePath: "plugin.json",
        });
        expect([cap.translatesAsMarketplace(), cap.buildMode()]).toStrictEqual([
          false,
          "marketplace",
        ]);
      });
    });

    describe("flat mode", () => {
      it("builds flat automatically", () => {
        const cap = new PluginsCapability({
          mode: "flat",
          acceptsHooks: false,
          hooksUnsupportedReason: "a test double that hosts no plugin directory",
          flatNamespacePrefix: "aidd-",
        });
        expect([cap.translatesAsMarketplace(), cap.buildMode()]).toStrictEqual([false, "flat"]);
      });
    });

    describe("unsupported mode", () => {
      it("does not build as a marketplace", () => {
        const cap = new PluginsCapability({
          mode: "unsupported",
          hooksUnsupportedReason: "a test double that hosts no plugin directory",
        });
        expect([cap.translatesAsMarketplace(), cap.buildMode()]).toStrictEqual([
          false,
          "marketplace",
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

  it("stays in the project when the scope is project, even with a user directory declared", () => {
    const cap = new PluginsCapability({
      ...native,
      userPluginsDir: (home) => `${home}/.x/plugins`,
    });

    expect(cap.resolvePluginsBaseDir("/repo", "/home/me")).toBe("/repo");
    expect(cap.userPluginsBaseDir("/home/me")).toBe("/home/me/.x/plugins");
  });

  it("stays in the project for a capability declaring no user directory at all", () => {
    const cap = new PluginsCapability(native);

    expect(cap.resolvePluginsBaseDir("/repo", "/home/me")).toBe("/repo");
    expect(cap.userPluginsBaseDir("/home/me")).toBeNull();
  });

  it("names a plugin's own directory under the plugins directory in native mode only", () => {
    expect(new PluginsCapability(native).pluginOutputDir("p")).toBe(".x/plugins/p/");
    expect(
      new PluginsCapability({
        mode: "flat",
        acceptsHooks: true,
        flatHooksDir: ".x/hooks/",
        flatNamespacePrefix: "aidd-",
      }).pluginOutputDir("p")
    ).toBeNull();
  });

  it("refuses a project hooks destination that names no project hooks file", () => {
    expect(() => new PluginsCapability({ ...native, hooksDestination: "project" })).toThrow(
      "hooksDestination 'project' requires a projectHooksRelativePath."
    );
  });

  it("refuses a project hooks destination that declares no file format", () => {
    expect(
      () =>
        new PluginsCapability({
          ...native,
          hooksDestination: "project",
          projectHooksRelativePath: ".x/hooks.json",
        })
    ).toThrow("hooksDestination 'project' requires a projectHooksFormat.");
  });

  it("refuses a project hooks format without a project hooks destination", () => {
    expect(
      () => new PluginsCapability({ ...native, projectHooksFormat: projectHooksFormat })
    ).toThrow("projectHooksFormat requires hooksDestination 'project'.");
  });

  it("lets a flat capability merge its hooks into a project hooks file", () => {
    const cap = new PluginsCapability({
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
    const cap = new PluginsCapability({
      mode: "native",
      pluginRootToken: "$X_PLUGIN_ROOT",
      acceptsHooks: true,
      pluginsDir: ".x/plugins/",
      pluginManifestRelativePath: null,
    });

    expect([cap.mcpFile().accepts, cap.deliversHooksToProject()]).toStrictEqual([false, false]);
  });

  it("fixes the same two answers for a flat tool", () => {
    const cap = new PluginsCapability({
      mode: "flat",
      acceptsHooks: true,
      flatHooksDir: ".x/hooks/",
      flatNamespacePrefix: "aidd-",
    });

    expect([cap.mcpFile().accepts, cap.deliversHooksToProject()]).toStrictEqual([false, false]);
  });

  it("accepts neither hooks nor mcp for a tool hosting no plugin at all", () => {
    const cap = new PluginsCapability({ mode: "unsupported", hooksUnsupportedReason: "none" });

    expect([
      cap.hooksAcceptance().accepts,
      cap.mcpFile().accepts,
      cap.deliversHooksToProject(),
    ]).toStrictEqual([false, false, false]);
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

  it("refuses a native mode that names no plugin root token", () => {
    const { pluginRootToken: _omitted, ...withoutToken } = native;
    expect(() => new PluginsCapability(withoutToken)).toThrow("pluginRootToken");
  });

  it("refuses marketplace settings its tool has no native activation to drive", () => {
    expect(
      () => new PluginsCapability({ ...native, marketplaceSettings: MARKETPLACE_SETTINGS })
    ).toThrow(CapabilityConfigError);
  });

  it("keeps marketplace settings next to the activation that drives them", () => {
    const cap = new PluginsCapability({
      ...native,
      marketplaceSettings: MARKETPLACE_SETTINGS,
      nativeActivation: { binary: "claude", enableVerb: "install", disableVerb: "uninstall" },
    });
    expect([cap.marketplaceRegistration()?.settingsPath, cap.activation()?.binary]).toEqual([
      ".claude/settings.json",
      "claude",
    ]);
  });
});
