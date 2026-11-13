import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FetchMarketplaceSource } from "../../../../src/contexts/distribution/application/fetch-marketplace-source.js";
import { ListMarketplaces } from "../../../../src/contexts/distribution/application/list-marketplaces.js";
import { ResolveMarketplace } from "../../../../src/contexts/distribution/application/resolve-marketplace.js";
import type { PluginCatalog } from "../../../../src/contexts/distribution/domain/catalog.js";
import { Marketplace } from "../../../../src/contexts/distribution/domain/marketplace.js";
import type { PluginCatalogRepository } from "../../../../src/contexts/distribution/ports/plugin-catalog-repository.js";
import { makeRegistryAdapter } from "../testing/registry-adapter.js";

const SAMPLE_MARKETPLACE = Marketplace.create({
  name: "awesome",
  source: { kind: "github", repo: "owner/awesome" },
  scope: "project",
  addedAt: "2026-04-29T10:00:00.000Z",
});

describe("ListMarketplaces", () => {
  let projectRoot: string;
  let homeDir: string;
  let originalHome: string | undefined;
  let originalConfigDir: string | undefined;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "mkt-list-project-"));
    homeDir = await mkdtemp(join(tmpdir(), "mkt-list-home-"));
    originalHome = process.env.HOME;
    originalConfigDir = process.env.AIDD_USER_CONFIG_DIR;
    process.env.HOME = homeDir;
    // Faking HOME alone is not enough: the CLI falls back to `homedir()` only when
    // `AIDD_USER_CONFIG_DIR` is unset, so a value leaking in sends this test at a real registry.
    process.env.AIDD_USER_CONFIG_DIR = join(homeDir, ".config", "aidd");
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    if (originalConfigDir === undefined) delete process.env.AIDD_USER_CONFIG_DIR;
    else process.env.AIDD_USER_CONFIG_DIR = originalConfigDir;
    await rm(projectRoot, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  describe("without withCatalogs", () => {
    it("returns marketplaces from the registry", async () => {
      const registry = makeRegistryAdapter();
      await registry.save(projectRoot, SAMPLE_MARKETPLACE);

      const useCase = new ListMarketplaces(registry);
      const result = await useCase.execute({ projectRoot });

      expect(result.marketplaces).toHaveLength(1);
      expect(result.marketplaces[0]?.name).toBe("awesome");
      expect(result.catalogs).toBeUndefined();
    });

    it("returns empty when nothing registered", async () => {
      const useCase = new ListMarketplaces(makeRegistryAdapter());
      const result = await useCase.execute({ projectRoot });
      expect(result.marketplaces).toEqual([]);
    });
  });

  describe("withCatalogs: true", () => {
    it("returns catalogs map keyed by marketplace name", async () => {
      const registry = makeRegistryAdapter();
      await registry.save(projectRoot, SAMPLE_MARKETPLACE);

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
      const registry = makeRegistryAdapter();
      await registry.save(projectRoot, SAMPLE_MARKETPLACE);

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
      const registry = makeRegistryAdapter();
      await registry.save(projectRoot, SAMPLE_MARKETPLACE);

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
      const registry = makeRegistryAdapter();
      await registry.save(projectRoot, SAMPLE_MARKETPLACE);

      const useCase = new ListMarketplaces(registry);
      const result = await useCase.execute({ projectRoot, withCatalogs: true });

      expect(result.marketplaces).toHaveLength(1);
      expect(result.catalogs).toBeDefined();
      expect(result.catalogs?.size).toBe(0);
    });
  });
});
