import { beforeEach, describe, expect, it } from "vitest";
import { ListMarketplaces } from "../../../../src/contexts/distribution/application/list-marketplaces.use-case.js";
import { Marketplace } from "../../../../src/contexts/distribution/domain/marketplace.js";
import { InMemoryMarketplaceRegistry } from "../../../shared/testing/in-memory-marketplace-registry.fake.js";

const SAMPLE_MARKETPLACE = Marketplace.create({
  name: "awesome",
  source: { kind: "github", repo: "owner/awesome" },
  scope: "project",
  addedAt: "2026-04-29T10:00:00.000Z",
});

describe("listing the registered marketplaces", () => {
  const projectRoot = "/project";
  let registry: InMemoryMarketplaceRegistry;

  beforeEach(async () => {
    registry = new InMemoryMarketplaceRegistry();
    await registry.save(projectRoot, SAMPLE_MARKETPLACE);
  });

  describe("when marketplaces are listed", () => {
    it("returns marketplaces from the registry", async () => {
      const useCase = new ListMarketplaces(registry);
      const result = await useCase.execute({ projectRoot });

      expect(result.marketplaces).toHaveLength(1);
      expect(result.marketplaces[0]?.name).toBe("awesome");
    });

    it("returns empty when nothing registered", async () => {
      const useCase = new ListMarketplaces(new InMemoryMarketplaceRegistry());
      const result = await useCase.execute({ projectRoot });
      expect(result.marketplaces).toEqual([]);
    });
  });
});
