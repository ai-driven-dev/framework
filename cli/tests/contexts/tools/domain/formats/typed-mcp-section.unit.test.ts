import { describe, expect, it } from "vitest";
import { toTypedMcpSection } from "../../../../../src/contexts/tools/domain/formats/typed-mcp-section.js";
import { saying } from "../../../../shared/testing/saying.builder.js";

describe("toTypedMcpSection()", () => {
  it("turns a command server into a local one, its arguments folded into the command line", () => {
    const converted = toTypedMcpSection(
      JSON.stringify({
        mcpServers: { context: { command: "npx", args: ["-y", "server"], env: { KEY: "v" } } },
      })
    );

    expect(JSON.parse(converted)).toStrictEqual({
      mcp: {
        context: {
          type: "local",
          command: ["npx", "-y", "server"],
          enabled: true,
          environment: { KEY: "v" },
        },
      },
    });
  });

  it("turns a url server into a remote one, and a disabled server into a disabled one", () => {
    const converted = toTypedMcpSection(
      JSON.stringify({ mcpServers: { hosted: { url: "https://example.test", disabled: true } } })
    );

    expect(JSON.parse(converted)).toStrictEqual({
      mcp: { hosted: { type: "remote", url: "https://example.test", enabled: false } },
    });
  });

  it("refuses a server that names neither a command nor a url", () => {
    expect(() => toTypedMcpSection(JSON.stringify({ mcpServers: { broken: {} } }))).toThrow(
      expect.objectContaining({ serverName: "broken" })
    );
  });

  it("refuses a config that is not a JSON object", () => {
    expect(() => toTypedMcpSection("[]")).toThrow(saying("MCP config must be a JSON object"));
    expect(() => toTypedMcpSection("{ not json")).toThrow(saying(/Cannot parse MCP config/));
  });

  it("refuses a config that is null or a bare value", () => {
    expect(() => toTypedMcpSection("null")).toThrow(saying("MCP config must be a JSON object"));
    expect(() => toTypedMcpSection("42")).toThrow(saying("MCP config must be a JSON object"));
  });
});
