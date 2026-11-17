import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  userBuiltCacheRoot,
  userBuiltMarketplaceDir,
} from "../../../../src/shared/domain/layout/aidd-layout.js";
import { pathContainsOrEquals } from "../../../../src/shared/domain/paths.js";

// The shared source is one per CLI version, so a purge of one version is a single `rm -rf`:
// two versions resolving to the same directory would take the other's registrations too.
describe("userBuiltMarketplaceDir()", () => {
  it("places the version segment before the marketplace name", () => {
    expect(userBuiltMarketplaceDir("/user-cache", "5.0.0", "aidd-framework", "claude")).toBe(
      join("/user-cache", "cache", "built", "5.0.0", "aidd-framework", "claude")
    );
  });

  it("produces disjoint directories for two different CLI versions", () => {
    const v1 = userBuiltMarketplaceDir("/user-cache", "1.0.0", "aidd-framework", "claude");
    const v2 = userBuiltMarketplaceDir("/user-cache", "2.0.0", "aidd-framework", "claude");

    expect(v1).not.toBe(v2);
    expect(pathContainsOrEquals(v1, v2)).toBe(false);
    expect(pathContainsOrEquals(v2, v1)).toBe(false);
  });
});

describe("userBuiltCacheRoot()", () => {
  it("is the parent every version directory sits under, one join above the version", () => {
    const root = userBuiltCacheRoot("/user-cache");
    const versioned = userBuiltMarketplaceDir("/user-cache", "5.0.0", "aidd-framework", "claude");

    expect(root).toBe(join("/user-cache", "cache", "built"));
    expect(pathContainsOrEquals(root, versioned)).toBe(true);
  });
});
