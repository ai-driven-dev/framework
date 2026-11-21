import { describe, expect, it } from "vitest";
import { CheckMarketplaces } from "../../../../src/contexts/distribution/application/check-marketplaces.js";
import type { PluginCatalog } from "../../../../src/contexts/distribution/contract/catalog.js";
import { Marketplace } from "../../../../src/contexts/distribution/domain/marketplace.js";
import { InMemoryMarketplaceRegistry } from "../../../shared/testing/in-memory-marketplace-registry.fake.js";
import { resolvingCatalogs } from "../testing/catalog-resolver.builder.js";

const PROJECT = "/project";
const DAY = 24 * 60 * 60 * 1000;

function marketplaceAt(name: string, lastFetched?: Date): Marketplace {
  const created = Marketplace.create({
    name,
    source: { kind: "local", path: `/mkt/${name}` },
    scope: "project",
    addedAt: "2026-01-01T00:00:00.000Z",
  });
  return lastFetched === undefined ? created : created.withLastFetched(lastFetched.toISOString());
}

function catalogListing(...names: string[]): PluginCatalog {
  return {
    plugins: names.map((name) => ({
      name,
      source: { kind: "local", path: `./${name}` },
      recommended: false,
      strict: false,
    })),
  };
}

async function registryOf(...marketplaces: Marketplace[]): Promise<InMemoryMarketplaceRegistry> {
  const registry = new InMemoryMarketplaceRegistry();
  for (const marketplace of marketplaces) await registry.save(PROJECT, marketplace);
  return registry;
}

describe("CheckMarketplaces", () => {
  it("reads the plugins each catalog lists", async () => {
    const registry = await registryOf(marketplaceAt("a", new Date()));
    const check = new CheckMarketplaces(
      registry,
      resolvingCatalogs({ "/mkt/a": catalogListing("x", "y") })
    );

    const { readings } = await check.execute({ projectRoot: PROJECT });

    expect(readings).toEqual([{ marketplace: "a", plugins: new Set(["x", "y"]) }]);
  });

  it("reads no plugins from a marketplace that has no catalog", async () => {
    const registry = await registryOf(marketplaceAt("a", new Date()));
    const check = new CheckMarketplaces(registry, resolvingCatalogs({ "/mkt/a": null }));

    const { readings } = await check.execute({ projectRoot: PROJECT });

    expect(readings).toEqual([{ marketplace: "a", plugins: null }]);
  });

  it("reports an unreadable catalog and keeps reading the others", async () => {
    const registry = await registryOf(
      marketplaceAt("a", new Date()),
      marketplaceAt("b", new Date())
    );
    const check = new CheckMarketplaces(
      registry,
      resolvingCatalogs({ "/mkt/a": new Error("offline"), "/mkt/b": catalogListing("x") })
    );

    const { readings } = await check.execute({ projectRoot: PROJECT });

    expect(readings).toEqual([
      { marketplace: "a", plugins: null, error: new Error("offline") },
      { marketplace: "b", plugins: new Set(["x"]) },
    ]);
  });

  it("lists as stale the marketplaces fetched longer ago than the default window or never", async () => {
    const registry = await registryOf(
      marketplaceAt("fresh", new Date(Date.now() - 1 * DAY)),
      marketplaceAt("old", new Date(Date.now() - 30 * DAY)),
      marketplaceAt("never")
    );
    const check = new CheckMarketplaces(registry, resolvingCatalogs({}));

    const { stale } = await check.execute({ projectRoot: PROJECT });

    expect(stale.map((m) => m.name)).toEqual(["old", "never"]);
  });

  it("applies the window the command names", async () => {
    const registry = await registryOf(marketplaceAt("a", new Date(Date.now() - 3 * DAY)));
    const check = new CheckMarketplaces(registry, resolvingCatalogs({}));

    const { stale } = await check.execute({ projectRoot: PROJECT, staleMaxDays: 2 });

    expect(stale.map((m) => m.name)).toEqual(["a"]);
  });
});
