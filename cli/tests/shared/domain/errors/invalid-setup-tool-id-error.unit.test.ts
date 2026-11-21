import { describe, expect, it } from "vitest";
import { InvalidSetupToolIdError } from "../../../../src/shared/domain/errors/invalid-setup-tool-id-error.js";

describe("InvalidSetupToolIdError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidSetupToolIdError("zed", ["claude", "cursor"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidSetupToolIdError",
      message: 'Invalid tool ID: "zed". Valid IDs: claude, cursor',
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidSetupToolIdError("zed", ["claude", "cursor"]).code).toBe(
      "invalid-setup-tool-id"
    );
  });
});
