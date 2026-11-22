import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RefreshMarketplace } from "../../../../../src/contexts/distribution/application/refresh/refresh-marketplace.use-case.js";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { marketplaceCacheDir } from "../../../../../src/contexts/distribution/domain/marketplace-cache-layout.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryMarketplaceRegistry } from "../../../../shared/testing/in-memory-marketplace-registry.fake.js";
import { resolvingCatalogs } from "../../testing/catalog-resolver.builder.js";

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
  const refresh = new RefreshMarketplace({
    registry,
    resolveMarketplace: resolvingCatalogs(catalogs),
  });
  return { refresh, registry };
}

describe("refreshing marketplaces", () => {
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

  it("detects no stale cache in a catalog it cannot parse", async () => {
    const { registry } = await refreshOver({ "/mkt/a": { plugins: [] } }, "a");
    const resolveMarketplace = resolvingCatalogs({ "/mkt/a": { plugins: [] } });
    const fs = new InMemoryFileAdapter({});
    const logger = new CapturingLogger();
    const refresh = new RefreshMarketplace({ registry, resolveMarketplace, logger, fs });
    const cacheDir = marketplaceCacheDir(PROJECT, "a");
    await fs.writeFile(`${cacheDir}/.claude-plugin/marketplace.json`, "not-json");

    await refresh.execute(PROJECT, marketplaceAt("a"));

    expect(logger.infoMessages.some((line) => line.includes("Detected stale"))).toBe(false);
  });

  it("reads a user-scope marketplace's cache from the user config directory", async () => {
    const registry = new InMemoryMarketplaceRegistry();
    const fs = new InMemoryFileAdapter({
      [join("/config/aidd", "cache", "marketplaces", "a", ".claude-plugin", "marketplace.json")]:
        JSON.stringify({ plugins: [{ name: "x", source: "./plugins/x" }] }),
    });
    const logger = new CapturingLogger();
    const refresh = new RefreshMarketplace({
      registry,
      resolveMarketplace: resolvingCatalogs({ "/mkt/a": { plugins: [] } }),
      userConfigDir: () => "/config/aidd",
      logger,
      fs,
    });
    const userScoped = Marketplace.create({
      name: "a",
      source: { kind: "local", path: "/mkt/a" },
      scope: "user",
      addedAt: "2026-01-01T00:00:00.000Z",
    });

    await refresh.execute(PROJECT, userScoped);

    expect(logger.infoMessages).toContain("Detected stale cache for 'a' — re-fetching.");
  });
});
