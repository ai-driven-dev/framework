import { describe, expect, it } from "vitest";
import { InvalidInstallScopeError } from "../../../../src/shared/domain/errors/invalid-install-scope-error.js";

describe("InvalidInstallScopeError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidInstallScopeError("global");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidInstallScopeError",
      message: "Invalid scope 'global'. Expected 'project' or 'user'.",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidInstallScopeError("global").code).toBe("invalid-install-scope");
  });
});
