import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  userBuiltCacheRoot,
  userBuiltMarketplaceDir,
} from "../../../../src/shared/domain/layout/aidd-layout.js";
import { pathContainsOrEquals } from "../../../../src/shared/domain/paths.model.js";

// The shared source is one per CLI version, so a purge of one version is a single `rm -rf`:
// two versions resolving to the same directory would take the other's registrations too.
describe("locating a built marketplace directory", () => {
  it("places the version segment before the marketplace name", () => {
    expect(
      userBuiltMarketplaceDir({
        userConfigDir: "/user-cache",
        cliVersion: "5.0.0",
        marketplaceName: "aidd-framework",
        target: "claude",
      })
    ).toBe(join("/user-cache", "cache", "built", "5.0.0", "aidd-framework", "claude"));
  });

  it("produces disjoint directories for two different CLI versions", () => {
    const v1 = userBuiltMarketplaceDir({
      userConfigDir: "/user-cache",
      cliVersion: "1.0.0",
      marketplaceName: "aidd-framework",
      target: "claude",
    });
    const v2 = userBuiltMarketplaceDir({
      userConfigDir: "/user-cache",
      cliVersion: "2.0.0",
      marketplaceName: "aidd-framework",
      target: "claude",
    });

    expect(v1).not.toBe(v2);
    expect(pathContainsOrEquals(v1, v2)).toBe(false);
    expect(pathContainsOrEquals(v2, v1)).toBe(false);
  });
});

describe("locating the built cache root", () => {
  it("is the parent every version directory sits under, one join above the version", () => {
    const root = userBuiltCacheRoot("/user-cache");
    const versioned = userBuiltMarketplaceDir({
      userConfigDir: "/user-cache",
      cliVersion: "5.0.0",
      marketplaceName: "aidd-framework",
      target: "claude",
    });

    expect(root).toBe(join("/user-cache", "cache", "built"));
    expect(pathContainsOrEquals(root, versioned)).toBe(true);
  });
});
