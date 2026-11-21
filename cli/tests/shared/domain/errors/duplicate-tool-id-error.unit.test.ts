import { describe, expect, it } from "vitest";
import { DuplicateToolIdError } from "../../../../src/shared/domain/errors/duplicate-tool-id-error.js";

describe("DuplicateToolIdError", () => {
  it("says exactly what went wrong", () => {
    const error = new DuplicateToolIdError("t");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "DuplicateToolIdError",
      message: "Tool 't' is registered twice.",
    });
  });

  it("carries its stable code", () => {
    expect(new DuplicateToolIdError("t").code).toBe("duplicate-tool-id");
  });
});
