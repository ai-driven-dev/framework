import { beforeEach, describe, expect, it, vi } from "vitest";
import { FetchMarketplaceSource } from "../../../../src/contexts/distribution/application/fetch-marketplace-source.js";
import { ListMarketplaces } from "../../../../src/contexts/distribution/application/list-marketplaces.js";
import { ResolveMarketplace } from "../../../../src/contexts/distribution/application/resolve-marketplace.js";
import type { PluginCatalog } from "../../../../src/contexts/distribution/domain/catalog.js";
import { Marketplace } from "../../../../src/contexts/distribution/domain/marketplace.js";
import type { PluginCatalogRepository } from "../../../../src/contexts/distribution/ports/plugin-catalog-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../helpers/ports/in-memory-marketplace-registry.js";

const SAMPLE_MARKETPLACE = Marketplace.create({
  name: "awesome",
  source: { kind: "github", repo: "owner/awesome" },
  scope: "project",
  addedAt: "2026-04-29T10:00:00.000Z",
});

describe("ListMarketplaces", () => {
  const projectRoot = "/project";
  let registry: InMemoryMarketplaceRegistry;

  beforeEach(async () => {
    registry = new InMemoryMarketplaceRegistry();
    await registry.save(projectRoot, SAMPLE_MARKETPLACE);
  });

  describe("without withCatalogs", () => {
    it("returns marketplaces from the registry", async () => {
      const useCase = new ListMarketplaces(registry);
      const result = await useCase.execute({ projectRoot });

      expect(result.marketplaces).toHaveLength(1);
      expect(result.marketplaces[0]?.name).toBe("awesome");
      expect(result.catalogs).toBeUndefined();
    });

    it("returns empty when nothing registered", async () => {
      const useCase = new ListMarketplaces(new InMemoryMarketplaceRegistry());
      const result = await useCase.execute({ projectRoot });
      expect(result.marketplaces).toEqual([]);
    });
  });

  describe("withCatalogs: true", () => {
    it("returns catalogs map keyed by marketplace name", async () => {
      const fakeCatalog: PluginCatalog = {
        plugins: [
          {
            name: "my-plugin",
            version: "1.0.0",
            source: { kind: "local", path: "/fake" },
            recommended: false,
            strict: false,
          },
        ],
      };
      const fakeFetcher = new FetchMarketplaceSource({
        fetch: async () => "/fake/local-path",
      });
      const fakeCatalogRepo: PluginCatalogRepository = {
        load: async () => fakeCatalog,
      };
      const resolveMarketplace = new ResolveMarketplace(fakeFetcher, fakeCatalogRepo);

      const useCase = new ListMarketplaces(registry, resolveMarketplace);
      const result = await useCase.execute({ projectRoot, withCatalogs: true });

      expect(result.marketplaces).toHaveLength(1);
      expect(result.catalogs).toBeDefined();
      expect(result.catalogs?.get("awesome")).toBe(fakeCatalog);
    });

    it("skips marketplace when catalog fetch fails and continues", async () => {
      const failingFetcher = new FetchMarketplaceSource({
        fetch: async () => {
          throw new Error("network error");
        },
      });
      const fakeCatalogRepo: PluginCatalogRepository = {
        load: async () => null,
      };
      const resolveMarketplace = new ResolveMarketplace(failingFetcher, fakeCatalogRepo);

      const useCase = new ListMarketplaces(registry, resolveMarketplace);
      const result = await useCase.execute({ projectRoot, withCatalogs: true });

      expect(result.marketplaces).toHaveLength(1);
      expect(result.catalogs).toBeDefined();
      expect(result.catalogs?.size).toBe(0);
    });

    it("logs a warning through the logger when the catalog fetch fails", async () => {
      const failingFetcher = new FetchMarketplaceSource({
        fetch: async () => {
          throw new Error("network error");
        },
      });
      const fakeCatalogRepo: PluginCatalogRepository = {
        load: async () => null,
      };
      const resolveMarketplace = new ResolveMarketplace(failingFetcher, fakeCatalogRepo);
      const logger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn() };

      const useCase = new ListMarketplaces(registry, resolveMarketplace, logger);
      await useCase.execute({ projectRoot, withCatalogs: true });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Skipping marketplace 'awesome'")
      );
    });

    it("skips catalog fetching entirely when resolveMarketplace is not wired", async () => {
      const useCase = new ListMarketplaces(registry);
      const result = await useCase.execute({ projectRoot, withCatalogs: true });

      expect(result.marketplaces).toHaveLength(1);
      expect(result.catalogs).toBeDefined();
      expect(result.catalogs?.size).toBe(0);
    });
  });
});
