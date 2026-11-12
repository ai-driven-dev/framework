import { describe, expect, it } from "vitest";
import { registeredAiProfile, registeredProfile } from "../../testing/catalog-of.js";

describe("what a project check asks a tool profile", () => {
  describe("the signal directory", () => {
    it("names where the tool's own commands sit, under the project and from its root", () => {
      expect(registeredAiProfile("claude").signalDirectoryIn("/p")).toStrictEqual({
        absolute: "/p/.claude/commands",
        relative: ".claude/commands",
      });
    });

    it("answers null for an AI tool declaring none", () => {
      expect(registeredAiProfile("antigravity").signalDirectoryIn("/p")).toBeNull();
    });

    it("answers null for an editor declaring none", () => {
      expect(registeredProfile("vscode").signalDirectoryIn("/p")).toBeNull();
    });
  });

  describe("where installed rules live", () => {
    it("names the directory and the extension an installed rule ends in", () => {
      expect(registeredAiProfile("claude").installedRulesLocation()).toStrictEqual({
        directory: ".claude/rules/",
        extension: ".md",
      });
    });

    it("answers null for a tool installing no rules", () => {
      expect(registeredAiProfile("antigravity").installedRulesLocation()).toBeNull();
    });
  });

  describe("whether enabling a plugin acts on the whole machine", () => {
    it("is not so for a tool that enables a plugin for one project", () => {
      expect(registeredAiProfile("claude").pluginEnablementIsMachineGlobal()).toBe(false);
    });

    it("is so for a tool whose own CLI takes no scope", () => {
      expect(registeredAiProfile("codex").pluginEnablementIsMachineGlobal()).toBe(true);
    });

    it("is so for a tool with no native plugin CLI at all", () => {
      expect(registeredAiProfile("opencode").pluginEnablementIsMachineGlobal()).toBe(true);
    });
  });

  describe("the marketplaces a tool's settings file declares", () => {
    it("names those listed in the tool's settings key, as a map or as a list", () => {
      const claude = registeredAiProfile("claude");

      expect(
        claude.declaredMarketplaceNames({ extraKnownMarketplaces: { a: {}, b: {} } })
      ).toStrictEqual(new Set(["a", "b"]));
      expect(claude.declaredMarketplaceNames({ extraKnownMarketplaces: ["a", "b"] })).toStrictEqual(
        new Set(["a", "b"])
      );
    });

    it("names none under another key or from a value that is no object", () => {
      const claude = registeredAiProfile("claude");

      expect(claude.declaredMarketplaceNames({ other: { a: {} } })).toStrictEqual(new Set());
      expect(claude.declaredMarketplaceNames(null)).toStrictEqual(new Set());
    });

    it("names none for a tool with no native plugin CLI", () => {
      expect(
        registeredAiProfile("cursor").declaredMarketplaceNames({ extraKnownMarketplaces: ["a"] })
      ).toStrictEqual(new Set());
    });
  });

  describe("whether a host keeps a registry of marketplaces", () => {
    it("is so for a host whose registry this CLI reads", () => {
      expect(registeredAiProfile("claude").nativeActivation()?.keepsMarketplaceRegistry()).toBe(
        true
      );
    });

    it("is not so for a host declaring none", () => {
      expect(registeredAiProfile("codex").nativeActivation()?.keepsMarketplaceRegistry()).toBe(
        false
      );
    });
  });

  describe("how a tool registers marketplaces in its shared settings file", () => {
    const input = { name: "aidd", source: { kind: "github", repo: "o/r" } } as const;

    it("names the shared file, the enabled-plugins key and whether a ref needs proof", () => {
      const claude = registeredAiProfile("claude").marketplaceRegistration();
      const copilot = registeredAiProfile("copilot").marketplaceRegistration();

      expect(claude?.sharedSettingsFile()).toBe(".claude/settings.json");
      expect(claude?.writesEnabledPlugins()).toBe(true);
      expect(claude?.requiresNativeProof()).toBe(false);
      expect(copilot?.sharedSettingsFile()).toBe(".github/copilot/settings.json");
      expect(copilot?.requiresNativeProof()).toBe(true);
    });

    it("reads and records the enabled-plugins map of a parsed shared file", () => {
      const registration = registeredAiProfile("claude").marketplaceRegistration();
      const shared: Record<string, unknown> = {};

      registration?.recordEnabledPlugins(shared, { "p@m": true });

      expect(shared).toStrictEqual({ enabledPlugins: { "p@m": true } });
      expect(registration?.enabledPluginsIn(shared)).toStrictEqual({ "p@m": true });
    });

    it("drops the marketplaces declaration and says whether one was there", () => {
      const registration = registeredAiProfile("claude").marketplaceRegistration();
      const shared: Record<string, unknown> = { extraKnownMarketplaces: {}, keep: 1 };

      expect(registration?.dropMarketplaces(shared)).toBe(true);
      expect(shared).toStrictEqual({ keep: 1 });
      expect(registration?.dropMarketplaces(shared)).toBe(false);
    });

    it("names the entry key a marketplace is keyed by", () => {
      expect(registeredAiProfile("claude").marketplaceRegistration()?.entryKeyFor(input)).toBe(
        "aidd"
      );
    });

    it("answers none for a tool with no native plugin CLI", () => {
      expect(registeredAiProfile("cursor").marketplaceRegistration()).toBeNull();
    });
  });
});
