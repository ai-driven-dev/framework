import { describe, expect, it } from "vitest";
import { ProjectScopeUnsupportedError } from "../../../../src/shared/domain/errors/project-scope-unsupported-error.js";

describe("ProjectScopeUnsupportedError", () => {
  it("says exactly what went wrong", () => {
    const error = new ProjectScopeUnsupportedError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ProjectScopeUnsupportedError",
      message:
        "Cursor plugins only support user-scope install (~/.cursor/plugins/local/). Project-scope is not auto-loaded by Cursor.",
    });
  });

  it("carries its stable code", () => {
    expect(new ProjectScopeUnsupportedError().code).toBe("cursor-project-scope-unsupported");
  });
});
