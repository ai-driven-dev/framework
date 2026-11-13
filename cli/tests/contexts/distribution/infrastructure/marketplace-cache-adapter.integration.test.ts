import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketplaceCacheAdapter } from "../../../../src/contexts/distribution/infrastructure/marketplace-cache-adapter.js";
import { MARKETPLACE_CACHE_SUBDIR } from "../../../../src/kernel/paths.js";

// What clearing promises whatever holds the cache is in `ports/marketplace-cache.contract`;
// what stays here is a cache directory that is not there.
describe("MarketplaceCacheAdapter", () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "aidd-marketplace-cache-"));
    await mkdir(join(projectRoot, MARKETPLACE_CACHE_SUBDIR), { recursive: true });
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("does not throw when cache directory does not exist", async () => {
    await rm(join(projectRoot, MARKETPLACE_CACHE_SUBDIR), { recursive: true, force: true });

    await expect(new MarketplaceCacheAdapter(projectRoot).clear()).resolves.not.toThrow();
  });
});
