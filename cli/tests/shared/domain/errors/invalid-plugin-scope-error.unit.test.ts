import { describe, expect, it } from "vitest";
import { InvalidPluginScopeError } from "../../../../src/shared/domain/errors/invalid-plugin-scope-error.js";

describe("InvalidPluginScopeError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidPluginScopeError("cursor", "project", "user");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidPluginScopeError",
      message:
        "Tool 'cursor' does not support scope 'project'. Supported scope: 'user'. Re-run with --scope user or omit the flag.",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidPluginScopeError("cursor", "project", "user").code).toBe(
      "invalid-plugin-scope"
    );
  });
});
