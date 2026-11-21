import { describe, expect, it } from "vitest";
import { InvalidMcpServerConfigError } from "../../../../src/shared/domain/errors/invalid-mcp-server-config-error.js";

describe("InvalidMcpServerConfigError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidMcpServerConfigError("db");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidMcpServerConfigError",
      message: 'MCP server "db" must have either a "command" or "url" field',
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidMcpServerConfigError("db").code).toBe("invalid-mcp-server-config");
  });
});
