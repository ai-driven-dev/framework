import { describe, expect, it } from "vitest";
import { UserScopeFilterUnsupportedError } from "../../../../src/shared/domain/errors/user-scope-filter-unsupported-error.js";

describe("UserScopeFilterUnsupportedError", () => {
  it("says exactly what went wrong", () => {
    const error = new UserScopeFilterUnsupportedError("--plugin", "sync");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UserScopeFilterUnsupportedError",
      message:
        "--scope user tracks nothing --plugin can narrow — it names every requested tool, not one plugin or one file. Drop --plugin, or run `aidd sync` at project scope.",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopeFilterUnsupportedError("--plugin", "sync").code).toBe(
      "user-scope-filter-unsupported"
    );
  });
});
