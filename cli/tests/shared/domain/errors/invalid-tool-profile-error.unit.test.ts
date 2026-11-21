import { describe, expect, it } from "vitest";
import { InvalidToolProfileError } from "../../../../src/shared/domain/errors/invalid-tool-profile-error.js";

describe("InvalidToolProfileError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidToolProfileError("t", "unknown-section", "d");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidToolProfileError",
      message: "The profile of 't' breaks 'unknown-section': d",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidToolProfileError("t", "unknown-section", "d").code).toBe(
      "invalid-tool-profile"
    );
  });
});
