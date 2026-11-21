import { describe, expect, it } from "vitest";
import { McpConfigError } from "../../../../src/shared/domain/errors/mcp-config-error.js";

describe("McpConfigError", () => {
  it("says exactly what went wrong", () => {
    const error = new McpConfigError("bad mcp");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "McpConfigError",
      message: "bad mcp",
    });
  });

  it("carries its stable code", () => {
    expect(new McpConfigError("bad mcp").code).toBe("mcp-config");
  });
});
