import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/profile.js";

describe("claude mcp", () => {
  describe("capabilities.mcp", () => {
    it("outputs to .mcp.json", () => {
      expect(claude.section("mcp").outputPath()).toBe(".mcp.json");
    });

    it("writes its servers as JSON under `mcpServers`", () => {
      const written = claude
        .section("mcp")
        .transform(JSON.stringify({ mcpServers: { a: { command: "node" } } }));
      expect(JSON.parse(written)).toHaveProperty("mcpServers");
    });

    it("does not consume unknown config names", () => {
      expect(claude.section("mcp").consumes("vscodeDir")).toBe(false);
    });

    it("mcp config preserves user customizations during update", () => {
      expect(claude.section("mcp").mergeStrategy()).toBe("user-prime");
    });
  });
});
