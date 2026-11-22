import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { PluginCatalog } from "../../../src/contexts/distribution/contract/catalog.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { resolvingCatalogs } from "../../contexts/distribution/testing/catalog-resolver.builder.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryMarketplaceCache } from "../../shared/testing/in-memory-marketplace-cache.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { refreshing } from "../../shared/testing/refreshing.builder.js";

const PROJECT = "/project";

function marketplaceAt(name: string): Marketplace {
  return Marketplace.create({
    name,
    source: { kind: "local", path: `/mkt/${name}` },
    scope: "project",
    addedAt: "2026-01-01T00:00:00.000Z",
  });
}

async function refreshOver(catalogs: Parameters<typeof resolvingCatalogs>[0], ...names: string[]) {
  const registry = new InMemoryMarketplaceRegistry();
  for (const name of names) await registry.save(PROJECT, marketplaceAt(name));
  const cache = new InMemoryMarketplaceCache();
  const resolver = resolvingCatalogs(catalogs);
  return {
    registry,
    cache,
    resolver,
    refresh: refreshing({ registry, resolveMarketplace: resolver, cache }),
  };
}

const EMPTY: PluginCatalog = { plugins: [] };

describe("RefreshMarketplace", () => {
  it("stamps each marketplace it fetched", async () => {
    const { refresh, registry } = await refreshOver({ "/mkt/a": EMPTY }, "a");

    const result = await refresh.execute({ projectRoot: PROJECT });

    expect(result).toEqual({ results: [{ name: "a", status: "ok" }], failedCount: 0 });
    expect((await registry.list(PROJECT))[0]?.lastFetched).toBeDefined();
  });

  it("records the version its catalog declares", async () => {
    const { refresh, registry } = await refreshOver(
      { "/mkt/a": { plugins: [], version: "2.0.0" } },
      "a"
    );

    await refresh.execute({ projectRoot: PROJECT });

    expect((await registry.list(PROJECT))[0]?.version).toBe("2.0.0");
  });

  it("reports a failed fetch and still refreshes the others", async () => {
    const { refresh, registry } = await refreshOver(
      { "/mkt/a": new Error("offline"), "/mkt/b": EMPTY },
      "a",
      "b"
    );

    const result = await refresh.execute({ projectRoot: PROJECT });

    expect(result.results).toEqual([
      { name: "a", status: "failed", error: new Error("offline") },
      { name: "b", status: "ok" },
    ]);
    expect(result.failedCount).toBe(1);
    const [a, b] = await registry.list(PROJECT);
    expect([a?.lastFetched, b?.lastFetched === undefined]).toEqual([undefined, false]);
  });

  it("refreshes only the marketplace named", async () => {
    const { refresh } = await refreshOver({ "/mkt/a": EMPTY, "/mkt/b": EMPTY }, "a", "b");

    const result = await refresh.execute({ projectRoot: PROJECT, name: "b" });

    expect(result.results.map((r) => r.name)).toEqual(["b"]);
  });

  it("clears the cache of the marketplace named before fetching, and only on force", async () => {
    const { refresh, cache } = await refreshOver({ "/mkt/a": EMPTY }, "a");

    await refresh.execute({ projectRoot: PROJECT, name: "a" });
    expect(cache.clearCalls).toEqual([]);

    await refresh.execute({ projectRoot: PROJECT, name: "a", force: true });
    expect(cache.clearCalls).toEqual(["a"]);
  });

  it("says a cache is stale when a plugin its catalog points at is gone", async () => {
    const { registry, cache, resolver } = await refreshOver({ "/mkt/a": EMPTY }, "a");
    const cacheDir = resolver.cacheDirOf(marketplaceAt("a"), PROJECT);
    const fs = new InMemoryFileAdapter({
      [`${cacheDir}/.claude-plugin/marketplace.json`]: JSON.stringify({
        plugins: [{ name: "x", source: "./plugins/x" }],
      }),
    });
    const logger = new CapturingLogger();

    await refreshing({
      registry,
      resolveMarketplace: resolver,
      cache,
      logger,
      fs,
    }).execute({
      projectRoot: PROJECT,
    });

    expect(logger.infoMessages).toContain("Detected stale cache for 'a' — re-fetching.");
  });

  it("stays silent about a cache whose plugins are all present", async () => {
    const { registry, cache, resolver } = await refreshOver({ "/mkt/a": EMPTY }, "a");
    const cacheDir = resolver.cacheDirOf(marketplaceAt("a"), PROJECT);
    const fs = new InMemoryFileAdapter({
      [`${cacheDir}/.claude-plugin/marketplace.json`]: JSON.stringify({
        plugins: [{ name: "x", source: "./plugins/x" }],
      }),
      // the product resolves a plugin path to an absolute one, drive included on Windows
      [resolve(cacheDir, "plugins/x/plugin.json")]: "{}",
    });
    const logger = new CapturingLogger();

    await refreshing({
      registry,
      resolveMarketplace: resolver,
      cache,
      logger,
      fs,
    }).execute({
      projectRoot: PROJECT,
    });

    expect(logger.infoMessages).toEqual(["Fetching marketplace 'a'..."]);
  });
});
