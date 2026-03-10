import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FrameworkCache } from "../../../src/infrastructure/cache/framework-cache.js";

async function createFrameworkDir(baseDir: string, name: string): Promise<string> {
  const dir = join(baseDir, name);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "framework.json"),
    JSON.stringify({ version: name, content: {}, templates: {}, config: {} })
  );
  return dir;
}

describe("FrameworkCache", () => {
  let cache: FrameworkCache;
  let testCacheBase: string;

  beforeEach(async () => {
    testCacheBase = join(tmpdir(), `framework-cache-test-${Date.now()}`);
    await mkdir(testCacheBase, { recursive: true });
    cache = new FrameworkCache(testCacheBase);
  });

  afterEach(async () => {
    await rm(testCacheBase, { recursive: true, force: true });
  });

  describe("put()", () => {
    it("copies extracted dir to cache and writes marker", async () => {
      const sourceDir = await createFrameworkDir(testCacheBase, "source");

      await cache.put("1.0.0", sourceDir);

      const cacheDir = cache.get("1.0.0");
      await expect(access(join(cacheDir, "framework.json"))).resolves.toBeUndefined();
      await expect(access(join(cacheDir, ".aidd-extracted"))).resolves.toBeUndefined();
    });
  });

  describe("has()", () => {
    it("confirms version is cached when marker exists", async () => {
      const sourceDir = await createFrameworkDir(testCacheBase, "source");
      await cache.put("2.0.0", sourceDir);

      expect(await cache.has("2.0.0")).toBe(true);
    });

    it("confirms a version that was never cached is not found", async () => {
      expect(await cache.has("9.9.9")).toBe(false);
    });

    it("confirms version is not cached when marker is missing", async () => {
      const dir = join(testCacheBase, "3.0.0");
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "agents"), "");

      expect(await cache.has("3.0.0")).toBe(false);
    });
  });

  describe("list()", () => {
    it("provides no entries when cache directory does not exist", async () => {
      const emptyCache = new FrameworkCache(join(testCacheBase, "nonexistent"));
      expect(await emptyCache.list()).toEqual([]);
    });

    it("lists cached versions sorted by semver ascending", async () => {
      const source = await createFrameworkDir(testCacheBase, "source");
      await cache.put("2.0.0", source);
      await cache.put("1.0.0", source);
      await cache.put("1.5.0", source);

      const result = await cache.list();
      expect(result.map((e) => e.version)).toEqual(["1.0.0", "1.5.0", "2.0.0"]);
    });

    it("provides path and size for each cached version", async () => {
      const source = await createFrameworkDir(testCacheBase, "source");
      await cache.put("1.0.0", source);

      const result = await cache.list();
      expect(result).toHaveLength(1);
      expect(result[0].version).toBe("1.0.0");
      expect(result[0].path).toContain("1.0.0");
      expect(result[0].size).toBeGreaterThan(0);
    });
  });

  describe("clear()", () => {
    it("clears a specific version", async () => {
      const source = await createFrameworkDir(testCacheBase, "source");
      await cache.put("1.0.0", source);
      await cache.put("2.0.0", source);

      await cache.clear("1.0.0");

      expect(await cache.has("1.0.0")).toBe(false);
      expect(await cache.has("2.0.0")).toBe(true);
    });

    it("clears all versions when no version given", async () => {
      const source = await createFrameworkDir(testCacheBase, "source");
      await cache.put("1.0.0", source);
      await cache.put("2.0.0", source);

      await cache.clear();

      expect(await cache.has("1.0.0")).toBe(false);
      expect(await cache.has("2.0.0")).toBe(false);
    });

    it("reports version not found when clearing a version that was never cached", async () => {
      await expect(cache.clear("9.9.9")).rejects.toThrow(
        "No cached framework found for version '9.9.9'."
      );
    });

    it("clears gracefully when cache is already empty", async () => {
      await expect(cache.clear()).resolves.toBeUndefined();
    });
  });

  describe("getLatestCached()", () => {
    it("provides no latest version when cache is empty", async () => {
      expect(await cache.getLatestCached()).toBeNull();
    });

    it("identifies the latest version by semver", async () => {
      const source = await createFrameworkDir(testCacheBase, "source");
      await cache.put("1.0.0", source);
      await cache.put("2.0.0", source);
      await cache.put("1.5.0", source);

      expect(await cache.getLatestCached()).toBe("2.0.0");
    });

    it("handles patch versions numerically", async () => {
      const source = await createFrameworkDir(testCacheBase, "source");
      await cache.put("1.0.1", source);
      await cache.put("1.0.10", source);
      await cache.put("1.0.2", source);

      expect(await cache.getLatestCached()).toBe("1.0.10");
    });
  });
});
