import { describe, expect, it } from "vitest";
import { FindUserMarketplace } from "../../../../../src/contexts/distribution/application/remove/find-user-marketplace.js";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { MarketplaceNotFoundError } from "../../../../../src/shared/domain/errors.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
import { InMemoryMarketplaceRegistry } from "../../../../shared/testing/in-memory-marketplace-registry.fake.js";

const PROJECT_ROOT = "/project";

function entry(scope: Scope): Marketplace {
  return Marketplace.create({
    name: "shared-name",
    source: { kind: "github", repo: "owner/shared" },
    scope,
    addedAt: "2026-04-29T10:00:00.000Z",
  });
}

/** Lists every entry as given, so two scopes can hold the same name at once. */
class ListingRegistry extends InMemoryMarketplaceRegistry {
  constructor(private readonly entries: readonly Marketplace[]) {
    super();
  }
  override async list(): Promise<readonly Marketplace[]> {
    return this.entries;
  }
}

describe("FindUserMarketplace", () => {
  it("does not take a project-scope marketplace of the same name for the user one", async () => {
    const find = new FindUserMarketplace(new ListingRegistry([entry("project")]));

    await expect(find.execute({ name: "shared-name", projectRoot: PROJECT_ROOT })).rejects.toThrow(
      MarketplaceNotFoundError
    );
  });
});
