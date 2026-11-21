import { describe, expect, it } from "vitest";
import { MarketplaceAlreadyRegisteredError } from "../../../../src/shared/domain/errors/marketplace-already-registered-error.js";

describe("MarketplaceAlreadyRegisteredError", () => {
  it("says exactly what went wrong", () => {
    const error = new MarketplaceAlreadyRegisteredError("aidd");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "MarketplaceAlreadyRegisteredError",
      message: "Marketplace 'aidd' is already registered.",
    });
  });

  it("carries its stable code", () => {
    expect(new MarketplaceAlreadyRegisteredError("aidd").code).toBe(
      "marketplace-already-registered"
    );
  });
});
