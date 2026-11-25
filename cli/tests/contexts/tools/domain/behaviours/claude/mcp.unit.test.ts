import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/composition/tool-profiles/claude.js";

describe("claude mcp", () => {
  describe("with Claude's mcp capability", () => {
    it("outputs to .mcp.json", () => {
      expect(claude.section("mcp").config?.accepts(".mcp.json")).toBe(true);
    });

    it("writes its servers as JSON under `mcpServers`", () => {
      const written = claude
        .section("mcp")
        .config?.transform(JSON.stringify({ mcpServers: { a: { command: "node" } } }));
      expect(JSON.parse(written)).toHaveProperty("mcpServers");
    });

    it("does not consume unknown config names", () => {
      expect(claude.section("mcp").config?.consumes("vscodeDir")).toBe(false);
    });

    it("mcp config preserves user customizations during update", () => {
      expect(claude.section("mcp").config?.fileOf("{}").mergeStrategy).toBe("user-prime");
    });
  });
});
