import { describe, expect, it } from "vitest";
import { IdentityOffWithIdentifierError } from "../../../../src/shared/domain/errors/identity-off-with-identifier-error.js";

describe("IdentityOffWithIdentifierError", () => {
  it("says exactly what went wrong", () => {
    const error = new IdentityOffWithIdentifierError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "IdentityOffWithIdentifierError",
      message: "--off removes the identity: give it no identifier.",
    });
  });

  it("carries its stable code", () => {
    expect(new IdentityOffWithIdentifierError().code).toBe("identity-off-with-identifier");
  });
});
