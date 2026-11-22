import { describe, expect, it } from "vitest";
import { CheckMarketplaces } from "../../../../src/contexts/distribution/application/check-marketplaces.use-case.js";
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
  it("hands out every registered marketplace", async () => {
    const registry = await registryOf(marketplaceAt("a", new Date()), marketplaceAt("b"));
    const check = new CheckMarketplaces(registry, resolvingCatalogs({}));

    const { marketplaces } = await check.execute({ projectRoot: PROJECT });

    expect(marketplaces.map((m) => m.name)).toEqual(["a", "b"]);
  });

  it("reads the plugins a catalog lists", async () => {
    const check = new CheckMarketplaces(
      await registryOf(),
      resolvingCatalogs({ "/mkt/a": catalogListing("x", "y") })
    );

    const names = await check.readPluginNames(marketplaceAt("a"), PROJECT);

    expect(names).toEqual(new Set(["x", "y"]));
  });

  it("reads no plugins from a marketplace that has no catalog", async () => {
    const check = new CheckMarketplaces(await registryOf(), resolvingCatalogs({ "/mkt/a": null }));

    expect(await check.readPluginNames(marketplaceAt("a"), PROJECT)).toBeNull();
  });

  it("lets the error of an unreadable catalog travel as it is", async () => {
    const offline = new Error("offline");
    const check = new CheckMarketplaces(
      await registryOf(),
      resolvingCatalogs({ "/mkt/a": offline })
    );

    await expect(check.readPluginNames(marketplaceAt("a"), PROJECT)).rejects.toBe(offline);
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
