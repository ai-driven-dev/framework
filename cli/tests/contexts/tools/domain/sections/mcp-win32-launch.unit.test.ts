import { describe, expect, it } from "vitest";
import { transformMcpForWin32 } from "../../../../../src/contexts/tools/domain/sections/mcp-win32-launch.js";

const through = (servers: Record<string, unknown>): unknown =>
  JSON.parse(transformMcpForWin32(JSON.stringify({ mcpServers: servers }))).mcpServers;

describe("an MCP launch is rewritten to run on Windows", () => {
  it("runs npx through cmd", () => {
    expect(through({ a: { command: "npx", args: ["pkg"] } })).toEqual({
      a: { command: "cmd", args: ["/c", "npx", "pkg"] },
    });
  });

  it("runs npx with no args through cmd", () => {
    expect(through({ a: { command: "npx" } })).toEqual({
      a: { command: "cmd", args: ["/c", "npx"] },
    });
  });

  it("names uvx and uv by their executable", () => {
    expect(through({ a: { command: "uvx" }, b: { command: "uv" } })).toEqual({
      a: { command: "uvx.exe" },
      b: { command: "uv.exe" },
    });
  });

  it("leaves any other launch as it is", () => {
    expect(through({ a: { command: "node", args: ["x"] }, b: {} })).toEqual({
      a: { command: "node", args: ["x"] },
      b: {},
    });
  });

  it("leaves a config with no servers as it is, re-indented", () => {
    expect(transformMcpForWin32('{"other":1}')).toBe('{\n  "other": 1\n}');
  });
});
