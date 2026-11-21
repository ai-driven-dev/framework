import { describe, expect, it } from "vitest";
import { ToolNotInstalledError } from "../../../../src/shared/domain/errors/tool-not-installed-error.js";

describe("ToolNotInstalledError", () => {
  it("includes tool ID in message without context", () => {
    const error = new ToolNotInstalledError("claude");
    expect(error.name).toBe("ToolNotInstalledError");
    expect(error.message).toContain("claude");
  });

  it("includes context and tool ID when context is provided", () => {
    const error = new ToolNotInstalledError("cursor", "The target tool");
    expect(error.message).toContain("cursor");
    expect(error.message).toContain("The target tool");
  });

  it("says exactly what went wrong (1)", () => {
    const error = new ToolNotInstalledError("claude");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ToolNotInstalledError",
      message: "claude is not installed",
    });
  });

  it("says exactly what went wrong (2)", () => {
    const error = new ToolNotInstalledError("cursor", "The target tool");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ToolNotInstalledError",
      message: "The target tool 'cursor' is not installed.",
    });
  });

  it("carries its stable code", () => {
    expect(new ToolNotInstalledError("claude").code).toBe("tool-not-installed");
  });
});
