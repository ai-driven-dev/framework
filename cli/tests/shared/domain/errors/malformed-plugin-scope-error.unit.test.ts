import { describe, expect, it } from "vitest";
import { MalformedPluginScopeError } from "../../../../src/shared/domain/errors/malformed-plugin-scope-error.js";

describe("MalformedPluginScopeError", () => {
  it("says exactly what went wrong", () => {
    const error = new MalformedPluginScopeError("aidd-dev", "global");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "MalformedPluginScopeError",
      message:
        'Plugin "aidd-dev" carries an invalid scope: "global". Expected "project" or "user".',
    });
  });

  it("carries its stable code", () => {
    expect(new MalformedPluginScopeError("aidd-dev", "global").code).toBe("malformed-plugin-scope");
  });
});
