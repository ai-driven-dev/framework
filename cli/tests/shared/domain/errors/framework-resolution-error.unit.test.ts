import { describe, expect, it } from "vitest";
import { FrameworkResolutionError } from "../../../../src/shared/domain/errors/framework-resolution-error.js";

describe("FrameworkResolutionError", () => {
  it("says exactly what went wrong", () => {
    const error = new FrameworkResolutionError("no framework");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "FrameworkResolutionError",
      message: "no framework",
    });
  });

  it("carries its stable code", () => {
    expect(new FrameworkResolutionError("no framework").code).toBe("framework-resolution");
  });
});
