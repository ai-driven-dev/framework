import { describe, expect, it } from "vitest";
import { codex } from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";

describe("codex mcp", () => {
  describe("capabilities.mcp", () => {
    it("outputs to .codex/config.toml", () => {
      expect(codex.section("mcp").config?.outputPath()).toBe(".codex/config.toml");
    });

    it("uses user-prime merge strategy", () => {
      expect(codex.section("mcp").config?.mergeStrategy()).toBe("user-prime");
    });

    it("writes its config in TOML", () => {
      const written = codex
        .section("mcp")
        .config?.transform(JSON.stringify({ mcpServers: { a: { command: "node" } } }));
      expect(() => JSON.parse(written)).toThrow();
      expect(written).toContain("mcp_servers.a");
    });
  });
});
