import { describe, expect, it } from "vitest";
import { VersionMismatchError } from "../../../../src/shared/domain/errors/version-mismatch-error.js";

describe("VersionMismatchError", () => {
  it("says exactly what went wrong", () => {
    const error = new VersionMismatchError("aidd-dev", "1.0.0", "2.0.0");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "VersionMismatchError",
      message:
        "Plugin 'aidd-dev': requested version '1.0.0' does not match catalog version '2.0.0'.",
    });
  });

  it("carries its stable code", () => {
    expect(new VersionMismatchError("aidd-dev", "1.0.0", "2.0.0").code).toBe("version-mismatch");
  });
});
