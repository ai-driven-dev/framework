import { describe, expect, it } from "vitest";
import { InvalidMarketplaceNameError } from "../../../../src/shared/domain/errors/invalid-marketplace-name-error.js";

describe("InvalidMarketplaceNameError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidMarketplaceNameError("My Market");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidMarketplaceNameError",
      message:
        'Invalid marketplace name: "My Market". Use lowercase alphanumeric characters and hyphens only.',
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidMarketplaceNameError("My Market").code).toBe("invalid-marketplace-name");
  });
});
