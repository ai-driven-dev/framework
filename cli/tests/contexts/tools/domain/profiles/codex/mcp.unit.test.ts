import { describe, expect, it } from "vitest";
import { codex } from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";

describe("codex mcp", () => {
  describe("capabilities.mcp", () => {
    it("outputs to .codex/config.toml", () => {
      expect(codex.capabilities.mcp.params.outputPath).toBe(".codex/config.toml");
    });

    it("consumes the mcp config name", () => {
      expect(codex.capabilities.mcp.consumes).toContain("mcp");
    });

    it("uses user-prime merge strategy", () => {
      expect(codex.capabilities.mcp.params.mergeStrategy ?? "user-prime").toBe("user-prime");
    });

    it("uses mcp_servers as entry section", () => {
      expect(codex.capabilities.mcp.params.entrySection).toBe("mcp_servers");
    });

    it("writes its config in TOML", () => {
      expect(codex.capabilities.mcp.params.format).toBe("toml");
    });
  });
});
