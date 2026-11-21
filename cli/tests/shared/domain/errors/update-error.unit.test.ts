import { describe, expect, it } from "vitest";
import { UpdateError } from "../../../../src/shared/domain/errors/update-error.js";

describe("UpdateError", () => {
  it("says exactly what went wrong", () => {
    const error = new UpdateError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UpdateError",
      message:
        "Update failed. If you saw a 403 error above, ensure your GitHub token includes both repo and read:packages scopes.\nUpdate your token at https://github.com/settings/tokens, then re-run `aidd auth login`.",
    });
  });

  it("carries its stable code", () => {
    expect(new UpdateError().code).toBe("update");
  });
});
