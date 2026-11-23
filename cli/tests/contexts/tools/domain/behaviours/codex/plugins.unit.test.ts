import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codexProfile } from "../../../../../../src/composition/tool-profiles/codex.js";
import { SmolTomlCodec } from "../../../../../../src/contexts/tools/infrastructure/smol-toml-codec.adapter.js";
import { nativeOf } from "../../../../../shared/testing/native-plugin-answers.builder.js";

const codex = codexProfile(new SmolTomlCodec());

describe("codex plugins", () => {
  describe("with Codex's plugins capability", () => {
    it("declares native codex CLI activation, with the verbs codex uses, and nothing else", () => {
      const activation = codex.nativeActivation();
      // Exhaustive, not `toMatchObject`: a verb added by mistake must fail here rather than escape.
      expect(activation?.hostBinary()).toBe("codex");
      expect(activation?.cliShape()).toEqual({
        upgradeVerb: "upgrade",
        enableVerb: "add",
        disableVerb: "remove",
      });
      expect(activation?.pluginRegistryAt("/home/tester")?.layout).toBe("toml-plugin-tables");
      expect(activation?.marketplaceSourcesDeclaration()).toEqual(
        expect.objectContaining({ from: "list-command", layout: "marketplaces-with-source" })
      );
    });

    it("declares its own plugin cache root, so clean can purge the empty shell codex leaves behind", () => {
      const activation = codex.nativeActivation();
      expect(activation?.pluginCacheRoot("/home/tester")).toBe(
        join("/home/tester", ".codex", "plugins", "cache")
      );
    });

    describe("when the user settings file is located", () => {
      const environment = (vars: Record<string, string>) => (name: string) => vars[name];

      it("falls back to ~/.codex/config.toml when CODEX_HOME is unset", () => {
        const activation = codex.nativeActivation();
        expect(activation?.userSettingsFile("/home/tester", environment({}))).toBe(
          join("/home/tester", ".codex", "config.toml")
        );
      });

      it("follows CODEX_HOME when a real machine has it set - the real codex binary reads there, not ~/.codex", () => {
        const activation = codex.nativeActivation();
        expect(
          activation?.userSettingsFile(
            "/home/tester",
            environment({ CODEX_HOME: "/somewhere/else" })
          )
        ).toBe(join("/somewhere/else", "config.toml"));
      });
    });

    it("does not write a project-local marketplace settings file", () => {
      expect(codex.marketplaceRegistration()).toBeNull();
    });

    it("warns that Codex runs no hook it has not been told to trust, and how to tell it", () => {
      expect(nativeOf(codex.plugins()).trustNotice()).toBe(
        "Codex will not run this plugin's hooks until each one is trusted — approve the prompt " +
          "once in an interactive session, or pass --dangerously-bypass-hook-trust to codex exec " +
          "for a headless run. Until then, none of its hooks run and nothing says why."
      );
    });
  });
});
