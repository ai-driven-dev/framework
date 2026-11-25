import { describe, expect, it } from "vitest";
import {
  fetchedMarketplaceDir,
  marketplaceCacheDir,
} from "../../../../src/contexts/distribution/domain/marketplace-cache-paths.model.js";

describe("locating a marketplace's cache directory", () => {
  it("nests the marketplace under the project's cache", () => {
    expect(marketplaceCacheDir("/p", "mkt").replace(/\\/g, "/")).toBe(
      "/p/.aidd/cache/marketplaces/mkt"
    );
  });
});

describe("locating a fetched marketplace's directory", () => {
  it("falls back to the project's cache for a user marketplace when no config directory is known", () => {
    expect(fetchedMarketplaceDir({ name: "m", scope: "user" }, "/p", undefined)).toBe(
      marketplaceCacheDir("/p", "m")
    );
  });
});
