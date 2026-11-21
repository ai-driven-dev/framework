import { describe, expect, it } from "vitest";
import { UserScopeUnavailableError } from "../../../../src/shared/domain/errors/user-scope-unavailable-error.js";

describe("UserScopeUnavailableError", () => {
  it("says exactly what went wrong", () => {
    const error = new UserScopeUnavailableError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UserScopeUnavailableError",
      message:
        "--scope user is not wired for this command yet — no user-scope manifest repository was provided at construction.",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopeUnavailableError().code).toBe("user-scope-unavailable");
  });
});
