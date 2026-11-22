import { describe, expect, it, vi } from "vitest";
import type { ResolveMarketplaceRequest } from "../../../src/contexts/distribution/application/resolve-marketplace.use-case.js";
import type { PluginCatalog } from "../../../src/contexts/distribution/contract/catalog.js";
import type { MarketplaceView } from "../../../src/contexts/distribution/contract/marketplace-view.js";
import { ListMarketplaceCatalogs } from "../../../src/orchestration/marketplace/list-marketplace-catalogs.use-case.js";

const view = (name: string): MarketplaceView => ({
  name,
  scope: "project",
  source: { kind: "local", path: `/mkt/${name}` },
  addedAt: "2026-01-01T00:00:00.000Z",
});

const catalogOf = (...names: string[]): PluginCatalog => ({
  plugins: names.map((name) => ({
    name,
    source: { kind: "local", path: "." },
    recommended: false,
    strict: false,
  })),
});

function listOf(
  marketplaces: MarketplaceView[],
  catalogs: Record<string, PluginCatalog | null | Error>
) {
  const resolve = {
    execute: vi.fn(async ({ marketplace }: ResolveMarketplaceRequest) => {
      const catalog = catalogs[marketplace.name] ?? null;
      if (catalog instanceof Error) throw catalog;
      return { marketplace, localPath: "/cache", catalog };
    }),
  };
  const logger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn() };
  const useCase = new ListMarketplaceCatalogs(
    { execute: vi.fn().mockResolvedValue({ marketplaces }) },
    resolve,
    logger
  );
  return { useCase, resolve, logger };
}

describe("listing marketplace catalogs", () => {
  it("keys each catalog by its marketplace and re-fetches it", async () => {
    const catalog = catalogOf("p");
    const { useCase, resolve } = listOf([view("a")], { a: catalog });

    const result = await useCase.execute({ projectRoot: "/project" });

    expect(result.marketplaces.map((m) => m.name)).toEqual(["a"]);
    expect(result.catalogs.get("a")).toBe(catalog);
    expect(resolve.execute).toHaveBeenCalledWith(
      expect.objectContaining({ projectRoot: "/project", forceRefresh: true })
    );
  });

  it("leaves out a marketplace with no catalog", async () => {
    const { useCase } = listOf([view("a")], { a: null });

    expect((await useCase.execute({ projectRoot: "/project" })).catalogs.size).toBe(0);
  });

  it("warns about a catalog it could not fetch and keeps going with the others", async () => {
    const offline = new Error("network error");
    const { useCase, logger } = listOf([view("a"), view("b")], {
      a: offline,
      b: catalogOf("p"),
    });

    const result = await useCase.execute({ projectRoot: "/project" });

    expect([...result.catalogs.keys()]).toEqual(["b"]);
    expect(logger.warn).toHaveBeenCalledWith("Skipping marketplace 'a': ", offline);
  });
});
