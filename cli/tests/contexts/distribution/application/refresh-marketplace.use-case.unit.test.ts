import { describe, expect, it } from "vitest";
import { RefreshMarketplace } from "../../../../src/contexts/distribution/application/refresh-marketplace.use-case.js";
import { Marketplace } from "../../../../src/contexts/distribution/domain/marketplace.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryMarketplaceCache } from "../../../shared/testing/in-memory-marketplace-cache.fake.js";
import { InMemoryMarketplaceRegistry } from "../../../shared/testing/in-memory-marketplace-registry.fake.js";
import { resolvingCatalogs } from "../testing/catalog-resolver.builder.js";

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
  const refresh = new RefreshMarketplace({
    registry,
    resolveMarketplace: resolvingCatalogs(catalogs),
    cache,
  });
  return { refresh, registry, cache };
}

describe("RefreshMarketplace", () => {
  it("targets every registered marketplace, or only the one named", async () => {
    const { refresh } = await refreshOver({}, "a", "b");

    const all = await refresh.targets({ projectRoot: PROJECT });
    const named = await refresh.targets({ projectRoot: PROJECT, name: "b" });

    expect([all.map((m) => m.name), named.map((m) => m.name)]).toEqual([["a", "b"], ["b"]]);
  });

  it("stamps the marketplace it fetched with its fetch time and declared version", async () => {
    const { refresh, registry } = await refreshOver(
      { "/mkt/a": { plugins: [], version: "2.0.0" } },
      "a"
    );

    await refresh.execute(PROJECT, marketplaceAt("a"));

    const [stamped] = await registry.list(PROJECT);
    expect([stamped?.lastFetched !== undefined, stamped?.version]).toEqual([true, "2.0.0"]);
  });

  it("lets a failed fetch travel and stamps nothing", async () => {
    const { refresh, registry } = await refreshOver({ "/mkt/a": new Error("offline") }, "a");

    await expect(refresh.execute(PROJECT, marketplaceAt("a"))).rejects.toThrow("offline");

    expect((await registry.list(PROJECT))[0]?.lastFetched).toBeUndefined();
  });

  it("clears the cache of the marketplace named only on force", async () => {
    const { refresh, cache } = await refreshOver({}, "a");

    await refresh.targets({ projectRoot: PROJECT, name: "a" });
    const unforced = [...cache.clearCalls];
    await refresh.targets({ projectRoot: PROJECT, name: "a", force: true });

    expect([unforced, cache.clearCalls]).toEqual([[], ["a"]]);
  });

  it("detects no stale cache in a catalog it cannot parse", async () => {
    const { registry, cache } = await refreshOver({ "/mkt/a": { plugins: [] } }, "a");
    const resolveMarketplace = resolvingCatalogs({ "/mkt/a": { plugins: [] } });
    const fs = new InMemoryFileAdapter({});
    const logger = new CapturingLogger();
    const refresh = new RefreshMarketplace({ registry, resolveMarketplace, cache, logger, fs });
    const cacheDir = resolveMarketplace.cacheDirOf(marketplaceAt("a"), PROJECT);
    await fs.writeFile(`${cacheDir}/.claude-plugin/marketplace.json`, "not-json");

    await refresh.execute(PROJECT, marketplaceAt("a"));

    expect(logger.infoMessages.some((line) => line.includes("Detected stale"))).toBe(false);
  });
});
