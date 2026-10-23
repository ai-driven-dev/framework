import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/profile.js";

describe("claude mcp", () => {
  describe("capabilities.mcp", () => {
    it("outputs to .mcp.json", () => {
      expect(claude.capabilities.mcp.params.outputPath).toBe(".mcp.json");
    });

    it("writes its servers as JSON under `mcpServers`", () => {
      expect(claude.capabilities.mcp.params).toMatchObject({
        format: "json",
        entrySection: "mcpServers",
      });
    });

    it("consumes the mcp config name", () => {
      expect(claude.capabilities.mcp.consumes).toContain("mcp");
    });

    it("does not consume unknown config names", () => {
      expect(claude.capabilities.mcp.consumes).not.toContain("vscodeDir");
    });

    it("mcp config preserves user customizations during update", () => {
      expect(claude.capabilities.mcp.params.mergeStrategy ?? "user-prime").toBe("user-prime");
    });
  });
});
