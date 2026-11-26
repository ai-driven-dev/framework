import { describe, expect, it } from "vitest";
import { serversKeyed } from "../../../../../../src/contexts/tools/domain/formats/mcp/servers-keyed.js";

describe("an MCP config keyed by servers", () => {
  it("renames mcpServers to the servers key VS Code reads, keeping every other key", () => {
    const content = JSON.stringify({ mcpServers: { ctx: { command: "node" } }, inputs: [] });
    expect(serversKeyed(content)).toBe(
      JSON.stringify({ inputs: [], servers: { ctx: { command: "node" } } }, null, 2)
    );
  });

  it("returns a config already keyed by servers byte for byte", () => {
    const content = JSON.stringify({ servers: { ctx: { command: "node" } } });
    expect(serversKeyed(content)).toBe(content);
  });

  it("renames nothing when a config carries both keys, rather than overwriting servers", () => {
    const content = JSON.stringify({ servers: { a: {} }, mcpServers: { b: {} } });
    expect(serversKeyed(content)).toBe(content);
  });
});
