import { describe, expect, it } from "vitest";
import { InvalidPluginVersionError } from "../../../../src/shared/domain/errors/invalid-plugin-version-error.js";

describe("InvalidPluginVersionError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidPluginVersionError("latest");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidPluginVersionError",
      message: 'Invalid plugin version: "latest". Expected semver format (e.g. 1.0.0).',
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidPluginVersionError("latest").code).toBe("invalid-plugin-version");
  });
});
