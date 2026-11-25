import { describe, expect, it } from "vitest";
import { RemoveMarketplace } from "../../../../../src/contexts/distribution/application/remove/remove-marketplace.use-case.js";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
import { InMemoryMarketplaceRegistry } from "../../../../shared/testing/in-memory-marketplace-registry.fake.js";

const PROJECT = "/project";

function registered(name: string, scope: Scope): Marketplace {
  return Marketplace.create({
    name,
    source: { kind: "local", path: `/mkt/${name}` },
    scope,
    addedAt: "2026-01-01T00:00:00.000Z",
  });
}

describe("removing a marketplace", () => {
  it("forgets the marketplace at the scope named and no other", async () => {
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT, registered("keep", "project"));
    await registry.save(PROJECT, registered("drop", "project"));
    await registry.save(PROJECT, registered("shared", "user"));

    await new RemoveMarketplace(registry).execute({
      projectRoot: PROJECT,
      marketplace: { name: "drop", scope: "project" },
    });

    expect((await registry.list(PROJECT)).map((m) => m.name)).toEqual(["keep", "shared"]);
  });

  it("forgets a user marketplace by name", async () => {
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT, registered("shared", "user"));

    await new RemoveMarketplace(registry).execute({
      projectRoot: PROJECT,
      marketplace: { name: "shared", scope: "user" },
    });

    expect(await registry.list(PROJECT)).toEqual([]);
  });
});
