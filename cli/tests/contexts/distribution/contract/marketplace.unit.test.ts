import { describe, expect, it } from "vitest";
import {
  assertNotReservedMarketplaceName,
  FRAMEWORK_MARKETPLACE_NAME,
} from "../../../../src/contexts/distribution/contract/marketplace.js";
import { InvalidMarketplaceNameError } from "../../../../src/shared/domain/errors.js";

describe("assertNotReservedMarketplaceName", () => {
  it("refuses the name the framework registers itself under", () => {
    expect(() => assertNotReservedMarketplaceName(FRAMEWORK_MARKETPLACE_NAME)).toThrow(
      InvalidMarketplaceNameError
    );
  });

  it("accepts any other name", () => {
    expect(() => assertNotReservedMarketplaceName("my-marketplace")).not.toThrow();
  });
});
