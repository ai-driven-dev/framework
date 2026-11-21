import { describe, expect, it } from "vitest";
import { AuthenticationError } from "../../../../src/shared/domain/errors/authentication-error.js";

describe("AuthenticationError", () => {
  it("says exactly what went wrong", () => {
    const error = new AuthenticationError("gh");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "AuthenticationError",
      message: "Authentication failed (gh). Run `aidd auth login` to authenticate.",
    });
  });

  it("carries its stable code", () => {
    expect(new AuthenticationError("gh").code).toBe("authentication");
  });
});
