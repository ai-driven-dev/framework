import { describe, expect, it } from "vitest";
import { InvalidBuildPathsError } from "../../../../src/shared/domain/errors/invalid-build-paths-error.js";

describe("InvalidBuildPathsError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidBuildPathsError("/src", "/src/out");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidBuildPathsError",
      message:
        "Refusing to build: --out '/src/out' and --source '/src' must not contain each other.",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidBuildPathsError("/src", "/src/out").code).toBe("invalid-build-paths");
  });
});
