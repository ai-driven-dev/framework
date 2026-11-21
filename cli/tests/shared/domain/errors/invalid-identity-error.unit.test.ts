import { describe, expect, it } from "vitest";
import { InvalidIdentityError } from "../../../../src/shared/domain/errors/invalid-identity-error.js";

describe("InvalidIdentityError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidIdentityError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidIdentityError",
      message: "An identity is one non-empty line of at most 128 characters. Nothing was changed.",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidIdentityError().code).toBe("invalid-identity");
  });
});
