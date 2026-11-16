import { describe, expect, it } from "vitest";
import { CONFIG_MCP } from "../../../../../../src/contexts/tools/domain/capabilities/config-refs.js";
import { cursor } from "../../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";

describe("cursor declarations the rest of the CLI reads", () => {
  it("has .cursor/ directory", () => {
    expect(cursor.directory).toBe(".cursor/");
  });

  it("probes a marketplace catalog at .cursor-plugin/marketplace.json", () => {
    expect(cursor.distributionProbes?.marketplace).toStrictEqual([
      ".cursor-plugin/marketplace.json",
    ]);
  });

  it("writes agents as markdown", () => {
    expect(cursor.capabilities.agents.params.format).toBe("markdown");
  });

  it("writes its MCP servers as JSON under `mcpServers`, in .cursor/mcp.json", () => {
    expect(cursor.capabilities.mcp.params).toMatchObject({
      outputPath: ".cursor/mcp.json",
      format: "json",
      entrySection: "mcpServers",
    });
    expect(cursor.capabilities.mcp.consumes).toStrictEqual([CONFIG_MCP]);
  });
});
