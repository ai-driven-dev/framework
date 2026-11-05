import { describe, expect, it } from "vitest";
import { codex } from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";

describe("codex hooks", () => {
  describe("capabilities.hooks", () => {
    it("outputs to .codex/hooks.json", () => {
      expect(codex.capabilities.hooks.buildOutputPath()).toBe(".codex/hooks.json");
    });

    it("consumes the codex-hooks config name", () => {
      expect(codex.capabilities.hooks.consumes).toContain("codex-hooks");
    });

    it("uses user-prime merge strategy", () => {
      expect(codex.capabilities.hooks.getMergeStrategy()).toBe("user-prime");
    });

    it("uses SessionStart as entry section", () => {
      expect(codex.capabilities.hooks.getEntrySection()).toBe("SessionStart");
    });

    it("returns null entry section for unknown config names", () => {
      const cap = [codex.capabilities.mcp, codex.capabilities.hooks].find((c) =>
        c.consumes.includes("unknown")
      );
      expect(cap).toBeUndefined();
    });
  });
});
