import { describe, expect, it } from "vitest";
import { PackageManagerDetectionError } from "../../../../src/shared/domain/errors/package-manager-detection-error.js";

describe("PackageManagerDetectionError", () => {
  it("says exactly what went wrong", () => {
    const error = new PackageManagerDetectionError(["npm i -g x", "pnpm add -g x"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "PackageManagerDetectionError",
      message: "Could not detect package manager. Run manually:\n  npm i -g x\n  pnpm add -g x",
    });
  });

  it("carries its stable code", () => {
    expect(new PackageManagerDetectionError(["npm i -g x", "pnpm add -g x"]).code).toBe(
      "package-manager-detection"
    );
  });
});
