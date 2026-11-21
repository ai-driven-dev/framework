import { describe, expect, it } from "vitest";
import { UserScopeNoToolsError } from "../../../../src/shared/domain/errors/user-scope-no-tools-error.js";

describe("UserScopeNoToolsError", () => {
  it("says exactly what went wrong", () => {
    const error = new UserScopeNoToolsError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UserScopeNoToolsError",
      message:
        "--global with no --ide registers the shared source for no tool at all. Pass `--ide <ids>` naming which tool to activate machine-wide.",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopeNoToolsError().code).toBe("user-scope-no-tools");
  });
});
