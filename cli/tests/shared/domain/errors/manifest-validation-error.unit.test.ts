import { describe, expect, it } from "vitest";
import { ManifestValidationError } from "../../../../src/shared/domain/errors/manifest-validation-error.js";

describe("ManifestValidationError", () => {
  it("says exactly what went wrong", () => {
    const error = new ManifestValidationError("bad manifest");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ManifestValidationError",
      message: "bad manifest",
    });
  });

  it("carries its stable code", () => {
    expect(new ManifestValidationError("bad manifest").code).toBe("manifest-validation");
  });
});
