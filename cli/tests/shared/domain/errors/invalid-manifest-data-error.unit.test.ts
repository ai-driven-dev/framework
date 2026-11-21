import { describe, expect, it } from "vitest";
import { InvalidManifestDataError } from "../../../../src/shared/domain/errors/invalid-manifest-data-error.js";

describe("InvalidManifestDataError", () => {
  it("says exactly what went wrong (1)", () => {
    const error = new InvalidManifestDataError("version missing");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidManifestDataError",
      message: "Invalid manifest data: version missing",
    });
  });

  it("says exactly what went wrong (2)", () => {
    const error = new InvalidManifestDataError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidManifestDataError",
      message: "Invalid manifest data.",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidManifestDataError("version missing").code).toBe("invalid-manifest-data");
  });
});
