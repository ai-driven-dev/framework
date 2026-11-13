import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HasherAdapter } from "../../../../src/contexts/framework/infrastructure/hasher-adapter.js";
import { UpdateCheckCacheAdapter } from "../../../../src/contexts/update/infrastructure/update-check-cache-adapter.js";
import { FileAdapter } from "../../../../src/shared/infrastructure/file-adapter.js";
import { InMemoryUpdateCheckCache } from "../testing/in-memory-update-check-cache.js";
import { describeUpdateCheckCacheContract } from "../testing/update-check-cache-contract.js";

describeUpdateCheckCacheContract("the in-memory cache", async () => {
  let cache = new InMemoryUpdateCheckCache();
  return {
    get cache() {
      return cache;
    },
    keepFromEarlierRelease: async (entry) => {
      cache = new InMemoryUpdateCheckCache(entry);
    },
    keepUnreadable: async () => {
      cache = new InMemoryUpdateCheckCache("unreadable");
    },
    dispose: async () => undefined,
  };
});

describeUpdateCheckCacheContract("UpdateCheckCacheAdapter over a directory", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aidd-update-cache-"));
  return {
    cache: new UpdateCheckCacheAdapter(new FileAdapter(new HasherAdapter()), () => dir),
    keepFromEarlierRelease: (entry) =>
      writeFile(join(dir, "update-check.json"), JSON.stringify(entry)),
    keepUnreadable: async () => {
      await mkdir(join(dir, "cache"));
      await writeFile(join(dir, "cache", "update-check.json"), "{ not json");
    },
    dispose: () => rm(dir, { recursive: true, force: true }),
  };
});
