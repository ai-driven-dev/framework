import { mkdir, mkdtemp, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MARKETPLACE_CACHE_SUBDIR } from "../../../../src/contexts/distribution/domain/marketplace-cache-paths.model.js";
import { MarketplaceCacheAdapter } from "../../../../src/contexts/distribution/infrastructure/marketplace-cache-adapter.js";
import { InMemoryMarketplaceCache } from "../../../shared/testing/in-memory-marketplace-cache.fake.js";
import { describeMarketplaceCacheContract } from "../testing/marketplace-cache.contract.js";

describeMarketplaceCacheContract("the in-memory cache", async () => {
  const cache = new InMemoryMarketplaceCache();
  return {
    cache,
    put: async (...names) => cache.add(...names),
    names: async () => cache.list(),
    dispose: async () => undefined,
  };
});

describeMarketplaceCacheContract("MarketplaceCacheAdapter over a directory", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "aidd-marketplace-cache-")));
  const cacheRoot = join(root, MARKETPLACE_CACHE_SUBDIR);
  await mkdir(cacheRoot, { recursive: true });
  return {
    cache: new MarketplaceCacheAdapter(root),
    put: async (...names) => {
      for (const name of names) await mkdir(join(cacheRoot, name), { recursive: true });
    },
    names: async () => (await readdir(cacheRoot)).sort(),
    dispose: () => rm(root, { recursive: true, force: true }),
  };
});
