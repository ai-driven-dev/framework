import { describe, expect, it } from "vitest";
import { ManifestUnavailableError } from "../../../../src/shared/domain/errors/manifest-unavailable-error.js";

describe("ManifestUnavailableError", () => {
  it("carries its stable code and name", () => {
    const error = new ManifestUnavailableError("manifest-missing");
    expect(error.code).toBe("manifest-missing");
    expect(error.name).toBe("ManifestUnavailableError");
  });

  it("carries the corrupted code", () => {
    expect(new ManifestUnavailableError("manifest-corrupted").code).toBe("manifest-corrupted");
  });

  it("says exactly what went wrong (1)", () => {
    const error = new ManifestUnavailableError("manifest-missing");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ManifestUnavailableError",
      message: "No AIDD manifest found. Run `aidd setup` to initialize your project.",
    });
  });

  it("says exactly what went wrong (2)", () => {
    const error = new ManifestUnavailableError("manifest-corrupted");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ManifestUnavailableError",
      message: "Manifest is corrupted (invalid JSON). Run `aidd clean --force` and re-initialize.",
    });
  });
});
