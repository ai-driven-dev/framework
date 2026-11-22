import { describe, expect, it } from "vitest";
import { CheckMarketplaces } from "../../../../src/contexts/distribution/application/check-marketplaces.use-case.js";
import { Marketplace } from "../../../../src/contexts/distribution/domain/marketplace.js";
import { InMemoryMarketplaceRegistry } from "../../../shared/testing/in-memory-marketplace-registry.fake.js";

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

async function registryOf(...marketplaces: Marketplace[]): Promise<InMemoryMarketplaceRegistry> {
  const registry = new InMemoryMarketplaceRegistry();
  for (const marketplace of marketplaces) await registry.save(PROJECT, marketplace);
  return registry;
}

describe("CheckMarketplaces", () => {
  it("hands out every registered marketplace", async () => {
    const registry = await registryOf(marketplaceAt("a", new Date()), marketplaceAt("b"));
    const check = new CheckMarketplaces(registry);

    const { marketplaces } = await check.execute({ projectRoot: PROJECT });

    expect(marketplaces.map((m) => m.name)).toEqual(["a", "b"]);
  });

  it("lists as stale the marketplaces fetched longer ago than the default window or never", async () => {
    const registry = await registryOf(
      marketplaceAt("fresh", new Date(Date.now() - 1 * DAY)),
      marketplaceAt("old", new Date(Date.now() - 30 * DAY)),
      marketplaceAt("never")
    );
    const check = new CheckMarketplaces(registry);

    const { stale } = await check.execute({ projectRoot: PROJECT });

    expect(stale.map((m) => m.name)).toEqual(["old", "never"]);
  });

  it("applies the window the command names", async () => {
    const registry = await registryOf(marketplaceAt("a", new Date(Date.now() - 3 * DAY)));
    const check = new CheckMarketplaces(registry);

    const { stale } = await check.execute({ projectRoot: PROJECT, staleMaxDays: 2 });

    expect(stale.map((m) => m.name)).toEqual(["a"]);
  });
});
