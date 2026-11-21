import { describe, expect, it } from "vitest";
import { UserScopeUnsupportedAiToolsError } from "../../../../src/shared/domain/errors/user-scope-unsupported-ai-tools-error.js";

describe("UserScopeUnsupportedAiToolsError", () => {
  it("says exactly what went wrong", () => {
    const error = new UserScopeUnsupportedAiToolsError(["cursor", "opencode"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UserScopeUnsupportedAiToolsError",
      message:
        "--global installs through an IDE's own plugin CLI or its user configuration directory, and neither exists for: cursor, opencode. Drop them from --ide, or run `aidd setup --ide <ids>` in the project instead.",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopeUnsupportedAiToolsError(["cursor", "opencode"]).code).toBe(
      "user-scope-unsupported-ai-tools"
    );
  });
});
