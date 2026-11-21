import { describe, expect, it } from "vitest";
import { UnregisteredToolError } from "../../../../src/shared/domain/errors/unregistered-tool-error.js";

describe("UnregisteredToolError", () => {
  it("says exactly what went wrong", () => {
    const error = new UnregisteredToolError("zed");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UnregisteredToolError",
      message: "Tool 'zed' is not registered.",
    });
  });

  it("carries its stable code", () => {
    expect(new UnregisteredToolError("zed").code).toBe("unregistered-tool");
  });
});
