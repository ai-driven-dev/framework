import { describe, expect, it } from "vitest";
import { UserScopeIdeToolsError } from "../../../../src/shared/domain/errors/user-scope-ide-tools-error.js";

describe("UserScopeIdeToolsError", () => {
  it("says exactly what went wrong", () => {
    const error = new UserScopeIdeToolsError(["vscode", "zed"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UserScopeIdeToolsError",
      message:
        "--global installs no project files, so an editor (vscode, zed) has nothing to install machine-wide. Drop it from --ide, or run `aidd setup --ide <ids>` separately in the project.",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopeIdeToolsError(["vscode", "zed"]).code).toBe("user-scope-ide-tools");
  });
});
