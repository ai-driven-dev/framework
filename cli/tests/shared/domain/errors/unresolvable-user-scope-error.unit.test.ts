import { describe, expect, it } from "vitest";
import { UnresolvableUserScopeError } from "../../../../src/shared/domain/errors/unresolvable-user-scope-error.js";

describe("UnresolvableUserScopeError", () => {
  it("says exactly what went wrong", () => {
    const error = new UnresolvableUserScopeError("cursor");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UnresolvableUserScopeError",
      message:
        'Manifest records a user-scope plugin for "cursor", but this tool\'s profile declares no user-scope plugins directory. Refusing to guess a base directory rather than silently resolving under the project root.',
    });
  });

  it("carries its stable code", () => {
    expect(new UnresolvableUserScopeError("cursor").code).toBe("unresolvable-user-scope");
  });
});
