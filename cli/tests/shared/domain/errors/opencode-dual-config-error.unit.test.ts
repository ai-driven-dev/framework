import { describe, expect, it } from "vitest";
import { OpencodeDualConfigError } from "../../../../src/shared/domain/errors/opencode-dual-config-error.js";

describe("OpencodeDualConfigError", () => {
  it("says exactly what went wrong", () => {
    const error = new OpencodeDualConfigError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "OpencodeDualConfigError",
      message: "Both opencode.json and opencode.jsonc exist. Remove one.",
    });
  });

  it("carries its stable code", () => {
    expect(new OpencodeDualConfigError().code).toBe("opencode-dual-config");
  });
});
