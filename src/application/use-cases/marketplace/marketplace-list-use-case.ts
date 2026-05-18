import type { Marketplace } from "../../../domain/models/marketplace.js";
import { marketplaceCacheDir } from "../../../domain/models/paths.js";
import type { PluginCatalog } from "../../../domain/models/plugin-catalog.js";
import type { MarketplaceRegistry } from "../../../domain/ports/marketplace-registry.js";
import type { PluginCatalogRepository } from "../../../domain/ports/plugin-catalog-repository.js";
import type { FetchMarketplaceSourceUseCase } from "../shared/fetch-marketplace-source-use-case.js";

export interface MarketplaceListOptions {
  projectRoot: string;
  withCatalogs?: boolean;
}

export interface MarketplaceListResult {
  marketplaces: readonly Marketplace[];
  catalogs?: Map<string, PluginCatalog>;
}

export class MarketplaceListUseCase {
  constructor(
    private readonly registry: MarketplaceRegistry,
    private readonly catalogRepo?: PluginCatalogRepository,
    private readonly fetchMarketplaceSource?: FetchMarketplaceSourceUseCase
  ) {}

  async execute(options: MarketplaceListOptions): Promise<MarketplaceListResult> {
    const marketplaces = await this.registry.list(options.projectRoot);
    if (!options.withCatalogs) return { marketplaces };
    const catalogs = await this.fetchCatalogs(marketplaces, options.projectRoot);
    return { marketplaces, catalogs };
  }

  private async fetchCatalogs(
    marketplaces: readonly Marketplace[],
    projectRoot: string
  ): Promise<Map<string, PluginCatalog>> {
    const catalogs = new Map<string, PluginCatalog>();
    for (const m of marketplaces) {
      await this.fetchOneCatalog(m, projectRoot, catalogs);
    }
    return catalogs;
  }

  private async fetchOneCatalog(
    marketplace: Marketplace,
    projectRoot: string,
    catalogs: Map<string, PluginCatalog>
  ): Promise<void> {
    if (this.fetchMarketplaceSource === undefined || this.catalogRepo === undefined) return;
    try {
      const cacheDir = marketplaceCacheDir(projectRoot, marketplace.name);
      const localPath = await this.fetchMarketplaceSource.execute({
        marketplace,
        cacheDir,
        fetchOptions: { forceRefresh: true },
      });
      const catalog = await this.catalogRepo.load(localPath);
      if (catalog !== null) catalogs.set(marketplace.name, catalog);
    } catch {
      // continue — resilience: skip failing marketplace
    }
  }
}
