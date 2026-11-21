import { describe, expect, it } from "vitest";
import { InvalidPluginManifestError } from "../../../../src/shared/domain/errors/invalid-plugin-manifest-error.js";

describe("InvalidPluginManifestError", () => {
  it("says exactly what went wrong (1)", () => {
    const error = new InvalidPluginManifestError("name missing");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidPluginManifestError",
      message: "Invalid plugin manifest: name missing",
    });
  });

  it("says exactly what went wrong (2)", () => {
    const error = new InvalidPluginManifestError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidPluginManifestError",
      message: "Invalid plugin manifest.",
    });
  });
});
