import { describe, expect, it } from "vitest";
import { ListMarketplacesToRefresh } from "../../../../../src/contexts/distribution/application/refresh/list-marketplaces-to-refresh.use-case.js";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { InMemoryMarketplaceCache } from "../../../../shared/testing/in-memory-marketplace-cache.fake.js";
import { InMemoryMarketplaceRegistry } from "../../../../shared/testing/in-memory-marketplace-registry.fake.js";

const PROJECT = "/project";

async function listingOver(...names: string[]) {
  const registry = new InMemoryMarketplaceRegistry();
  for (const name of names) {
    await registry.save(
      PROJECT,
      Marketplace.create({
        name,
        source: { kind: "local", path: `/mkt/${name}` },
        scope: "project",
        addedAt: "2026-01-01T00:00:00.000Z",
      })
    );
  }
  const cache = new InMemoryMarketplaceCache();
  return { listing: new ListMarketplacesToRefresh(registry, cache), cache };
}

describe("listing the marketplaces a refresh covers", () => {
  it("covers every registered marketplace, or only the one named", async () => {
    const { listing } = await listingOver("a", "b");

    const all = await listing.execute({ projectRoot: PROJECT });
    const named = await listing.execute({ projectRoot: PROJECT, name: "b" });

    expect([all.map((m) => m.name), named.map((m) => m.name)]).toEqual([["a", "b"], ["b"]]);
  });

  it("clears the cache of the marketplace named only on force", async () => {
    const { listing, cache } = await listingOver("a");

    await listing.execute({ projectRoot: PROJECT, name: "a" });
    const unforced = [...cache.clearCalls];
    await listing.execute({ projectRoot: PROJECT, name: "a", force: true });

    expect([unforced, cache.clearCalls]).toEqual([[], ["a"]]);
  });
});
