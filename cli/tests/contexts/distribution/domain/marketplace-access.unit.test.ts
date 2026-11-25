import { describe, expect, it } from "vitest";
import { MarketplaceAccess } from "../../../../src/contexts/distribution/domain/marketplace-access.js";

describe("deciding whether a marketplace is readable", () => {
  it("lets a holder of a token through, public or not", () => {
    expect(new MarketplaceAccess({ tokenPresent: true, repoPublic: false }).isReadable()).toBe(
      true
    );
  });

  it("lets a public repository through without a token", () => {
    expect(new MarketplaceAccess({ tokenPresent: false, repoPublic: true }).isReadable()).toBe(
      true
    );
  });

  it("refuses a private repository without a token", () => {
    expect(new MarketplaceAccess({ tokenPresent: false, repoPublic: false }).isReadable()).toBe(
      false
    );
  });
});
