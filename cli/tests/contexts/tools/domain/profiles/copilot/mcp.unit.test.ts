import { describe, expect, it } from "vitest";
import { copilot } from "../../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";

describe("copilot mcp", () => {
  describe("capabilities.mcp", () => {
    it("maps mcp to .vscode/mcp.json", () => {
      expect(copilot.section("mcp").config?.outputPath()).toBe(".vscode/mcp.json");
    });
  });

  describe("capabilities.mcp.transform()", () => {
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
