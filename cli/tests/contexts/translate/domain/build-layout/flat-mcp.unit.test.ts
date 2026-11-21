import { describe, expect, it } from "vitest";
import { flatMcpServers } from "../../../../../src/contexts/translate/domain/build-layout/flat-mcp.js";
import { aCanon } from "../../testing/canon-distribution.builder.js";

describe("the MCP servers of a plugin in a flat layout", () => {
  it("prefixes each server's key with the plugin's name, so plugins never share one", () => {
    const canon = aCanon("plug", {
      ".mcp.json": JSON.stringify({ mcpServers: { db: { command: "run" }, web: { url: "u" } } }),
    });
    expect(flatMcpServers(canon)).toEqual({
      "plug-db": { command: "run" },
      "plug-web": { url: "u" },
    });
  });

  it("holds no server for a declaration naming none", () => {
    expect(flatMcpServers(aCanon("plug", { ".mcp.json": "{}" }))).toEqual({});
  });

  it("is absent for a plugin with no MCP declaration", () => {
    expect(flatMcpServers(aCanon("plug", { "skills/x/SKILL.md": "x" }))).toBeNull();
  });
});
