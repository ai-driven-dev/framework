import { describe, expect, it } from "vitest";
import { UnknownAiToolIdError } from "../../../../src/shared/domain/errors/unknown-ai-tool-id-error.js";

describe("UnknownAiToolIdError", () => {
  it("says exactly what went wrong", () => {
    const error = new UnknownAiToolIdError("zed", ["claude", "cursor"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UnknownAiToolIdError",
      message: "Unknown AI tool: zed. Valid AI tools: claude, cursor",
    });
  });

  it("carries its stable code", () => {
    expect(new UnknownAiToolIdError("zed", ["claude", "cursor"]).code).toBe("unknown-ai-tool-id");
  });
});
