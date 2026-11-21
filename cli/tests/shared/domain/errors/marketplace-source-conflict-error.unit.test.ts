import { describe, expect, it } from "vitest";
import { MarketplaceSourceConflictError } from "../../../../src/shared/domain/errors/marketplace-source-conflict-error.js";

describe("MarketplaceSourceConflictError", () => {
  it("says exactly what went wrong", () => {
    const error = new MarketplaceSourceConflictError("name taken");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "MarketplaceSourceConflictError",
      message: "name taken",
    });
  });

  it("carries its stable code", () => {
    expect(new MarketplaceSourceConflictError("name taken").code).toBe(
      "marketplace-source-conflict"
    );
  });
});
