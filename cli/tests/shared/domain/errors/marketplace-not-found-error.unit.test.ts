import { describe, expect, it } from "vitest";
import { MarketplaceNotFoundError } from "../../../../src/shared/domain/errors/marketplace-not-found-error.js";

describe("MarketplaceNotFoundError", () => {
  it("says exactly what went wrong", () => {
    const error = new MarketplaceNotFoundError("aidd");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "MarketplaceNotFoundError",
      message: "Marketplace 'aidd' is not registered.",
    });
  });

  it("carries its stable code", () => {
    expect(new MarketplaceNotFoundError("aidd").code).toBe("marketplace-not-found");
  });
});
