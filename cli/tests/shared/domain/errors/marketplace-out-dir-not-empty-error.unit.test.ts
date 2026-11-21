import { describe, expect, it } from "vitest";
import { MarketplaceOutDirNotEmptyError } from "../../../../src/shared/domain/errors/marketplace-out-dir-not-empty-error.js";

describe("MarketplaceOutDirNotEmptyError", () => {
  it("says exactly what went wrong", () => {
    const error = new MarketplaceOutDirNotEmptyError("/out");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "MarketplaceOutDirNotEmptyError",
      message:
        "Refusing to build: '/out' is not empty. Re-run with --force to overwrite files this build produces, or choose an empty --out directory.",
    });
  });

  it("carries its stable code", () => {
    expect(new MarketplaceOutDirNotEmptyError("/out").code).toBe("marketplace-out-dir-not-empty");
  });
});
