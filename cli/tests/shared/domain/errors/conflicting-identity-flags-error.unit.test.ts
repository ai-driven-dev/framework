import { describe, expect, it } from "vitest";
import { ConflictingIdentityFlagsError } from "../../../../src/shared/domain/errors/conflicting-identity-flags-error.js";

describe("ConflictingIdentityFlagsError", () => {
  it("says exactly what went wrong", () => {
    const error = new ConflictingIdentityFlagsError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ConflictingIdentityFlagsError",
      message: "--as names you and --anonymous names nobody: give one of them.",
    });
  });

  it("carries its stable code", () => {
    expect(new ConflictingIdentityFlagsError().code).toBe("conflicting-identity-flags");
  });
});
