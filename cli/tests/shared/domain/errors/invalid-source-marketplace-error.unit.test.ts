import { describe, expect, it } from "vitest";
import { InvalidSourceMarketplaceError } from "../../../../src/shared/domain/errors/invalid-source-marketplace-error.js";

describe("InvalidSourceMarketplaceError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidSourceMarketplaceError("no plugins");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidSourceMarketplaceError",
      message: "Invalid source marketplace: no plugins.",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidSourceMarketplaceError("no plugins").code).toBe("invalid-source-marketplace");
  });
});
