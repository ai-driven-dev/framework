import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codex } from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";

describe("codex plugins", () => {
  describe("capabilities.plugins", () => {
    it("declares native codex CLI activation, with the verbs codex uses, and nothing else", () => {
      const activation = codex.capabilities.plugins.nativeActivation;
      // Exhaustive, not `toMatchObject`: a field added by mistake must fail here rather than
      // escape. `pluginCacheDir` is `expect.any(Function)`, since a function matches no literal.
      expect(activation).toEqual({
        binary: "codex",
        upgradeVerb: "upgrade",
        enableVerb: "add",
        disableVerb: "remove",
        pluginCacheDir: expect.any(Function),
        userSettingsPath: expect.any(Function),
      });
    });

    it("declares its own plugin cache root, so clean can purge the empty shell codex leaves behind", () => {
      const pluginCacheDir = codex.capabilities.plugins.nativeActivation?.pluginCacheDir;
      expect(pluginCacheDir?.("/home/tester")).toBe(
        join("/home/tester", ".codex", "plugins", "cache")
      );
    });

    describe("nativeActivation.userSettingsPath()", () => {
      const environment = (vars: Record<string, string>) => (name: string) => vars[name];

      it("falls back to ~/.codex/config.toml when CODEX_HOME is unset", () => {
        const userSettingsPath = codex.capabilities.plugins.nativeActivation?.userSettingsPath;
        expect(userSettingsPath?.("/home/tester", environment({}))).toBe(
          join("/home/tester", ".codex", "config.toml")
        );
      });

      it("follows CODEX_HOME when a real machine has it set — the real codex binary reads there, not ~/.codex", () => {
        const userSettingsPath = codex.capabilities.plugins.nativeActivation?.userSettingsPath;
        expect(
          userSettingsPath?.("/home/tester", environment({ CODEX_HOME: "/somewhere/else" }))
        ).toBe(join("/somewhere/else", "config.toml"));
      });
    });

    it("does not write a project-local marketplace settings file", () => {
      expect(codex.capabilities.plugins.marketplaceSettings).toBeNull();
    });

    it("keeps the marketplace translation mode", () => {
      expect(codex.capabilities.plugins.translationMode).toBe("marketplace");
    });

    it("warns that Codex runs no hook it has not been told to trust, and how to tell it", () => {
      expect(codex.capabilities.plugins.hooksTrustNotice).toBe(
        "Codex will not run this plugin's hooks until each one is trusted — approve the prompt " +
          "once in an interactive session, or pass --dangerously-bypass-hook-trust to codex exec " +
          "for a headless run. Until then, none of its hooks run and nothing says why."
      );
    });
  });
});
