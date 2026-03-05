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
    it("returns true when marker exists", async () => {
      const sourceDir = await createFrameworkDir(testCacheBase, "source");
      await cache.put("2.0.0", sourceDir);

      expect(await cache.has("2.0.0")).toBe(true);
    });

    it("returns false for a version that was never cached", async () => {
      expect(await cache.has("9.9.9")).toBe(false);
    });

    it("returns false when marker is missing", async () => {
      const dir = join(testCacheBase, "3.0.0");
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "agents"), "");

      expect(await cache.has("3.0.0")).toBe(false);
    });
  });

  describe("get()", () => {
    it("returns the cache directory path containing the version", () => {
      const path = cache.get("1.2.3");
      expect(path).toContain("1.2.3");
    });
  });

  describe("getLatestCached()", () => {
    it("returns null when no cache exists", async () => {
      expect(await cache.getLatestCached()).toBeNull();
    });

    it("returns the latest version by semver", async () => {
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
