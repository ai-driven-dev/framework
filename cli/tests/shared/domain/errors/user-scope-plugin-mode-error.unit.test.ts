import { describe, expect, it } from "vitest";
import { UserScopePluginModeError } from "../../../../src/shared/domain/errors/user-scope-plugin-mode-error.js";

describe("UserScopePluginModeError", () => {
  it("says exactly what went wrong", () => {
    const error = new UserScopePluginModeError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UserScopePluginModeError",
      message:
        "--global cannot ask which plugins to install. Pass --plugins all, recommended, none, or comma-separated names.",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopePluginModeError().code).toBe("user-scope-plugin-mode");
  });
});
