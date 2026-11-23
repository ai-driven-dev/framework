import { describe, expect, it } from "vitest";
import { copilot } from "../../../../../../src/composition/tool-profiles/copilot.js";

describe("copilot mcp", () => {
  describe("with Copilot's mcp capability", () => {
    it("maps mcp to .vscode/mcp.json", () => {
      expect(copilot.section("mcp").config?.accepts(".vscode/mcp.json")).toBe(true);
    });
  });

  describe("when Copilot's mcp config is transformed", () => {
    const transform = (content: string): string | undefined =>
      copilot.section("mcp").config?.transform(content);

    it("renames mcpServers to the servers key VS Code reads, keeping every other key", () => {
      const content = JSON.stringify({ mcpServers: { ctx: { command: "node" } }, inputs: [] });
      expect(transform(content)).toBe(
        JSON.stringify({ inputs: [], servers: { ctx: { command: "node" } } }, null, 2)
      );
    });

    it("returns a config already keyed by servers byte for byte", () => {
      const content = JSON.stringify({ servers: { ctx: { command: "node" } } });
      expect(transform(content)).toBe(content);
    });

    it("renames nothing when a config carries both keys, rather than overwriting servers", () => {
      const content = JSON.stringify({ servers: { a: {} }, mcpServers: { b: {} } });
      expect(transform(content)).toBe(content);
    });
  });
});
