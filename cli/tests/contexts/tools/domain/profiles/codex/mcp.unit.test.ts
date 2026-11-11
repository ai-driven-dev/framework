import { describe, expect, it } from "vitest";
import { codex } from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";

describe("codex mcp", () => {
  describe("capabilities.mcp", () => {
    it("outputs to .codex/config.toml", () => {
      expect(codex.section("mcp").outputPath()).toBe(".codex/config.toml");
    });

    it("uses user-prime merge strategy", () => {
      expect(codex.section("mcp").getMergeStrategy()).toBe("user-prime");
    });

    it("writes its config in TOML", () => {
      expect(codex.section("mcp").format()).toBe("toml");
    });
  });
});
