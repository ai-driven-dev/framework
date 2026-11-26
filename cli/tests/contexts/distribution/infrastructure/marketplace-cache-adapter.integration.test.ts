import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MARKETPLACE_CACHE_SUBDIR } from "../../../../src/contexts/distribution/domain/marketplace-cache-paths.model.js";
import { MarketplaceCacheAdapter } from "../../../../src/contexts/distribution/infrastructure/marketplace-cache-adapter.js";

// What clearing promises whatever holds the cache is in `ports/marketplace-cache.contract`;
// what stays here is a cache directory that is not there.
describe("clearing a marketplace cache", () => {
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

  it("refuses a cache directory it cannot read instead of reading it as empty", async () => {
    await rm(join(projectRoot, MARKETPLACE_CACHE_SUBDIR), { recursive: true, force: true });
    await writeFile(join(projectRoot, MARKETPLACE_CACHE_SUBDIR), "not a directory");

    await expect(new MarketplaceCacheAdapter(projectRoot).clear()).rejects.toMatchObject({
      code: "ENOTDIR",
    });
  });
});
