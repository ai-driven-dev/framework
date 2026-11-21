import { describe, expect, it } from "vitest";
import { InvalidManifestToolIdError } from "../../../../src/shared/domain/errors/invalid-manifest-tool-id-error.js";

describe("InvalidManifestToolIdError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidManifestToolIdError("zed");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidManifestToolIdError",
      message: "Invalid tool id in manifest: 'zed'.",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidManifestToolIdError("zed").code).toBe("invalid-manifest-tool-id");
  });
});
