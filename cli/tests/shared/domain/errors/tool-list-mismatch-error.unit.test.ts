import { describe, expect, it } from "vitest";
import { ToolListMismatchError } from "../../../../src/shared/domain/errors/tool-list-mismatch-error.js";

describe("ToolListMismatchError", () => {
  it("says exactly what went wrong", () => {
    const error = new ToolListMismatchError(["a", "b"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ToolListMismatchError",
      message: "Tool lists differ on: a, b.",
    });
  });

  it("carries its stable code", () => {
    expect(new ToolListMismatchError(["a", "b"]).code).toBe("tool-list-mismatch");
  });
});
