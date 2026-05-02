import type { Marketplace } from "../../../domain/models/marketplace.js";
import { marketplaceCacheDir } from "../../../domain/models/paths.js";
import type { PluginCatalog } from "../../../domain/models/plugin-catalog.js";
import type { PluginCatalogRepository } from "../../../domain/ports/plugin-catalog-repository.js";
import type { PluginFetcher } from "../../../domain/ports/plugin-fetcher.js";

export interface ResolveMarketplaceOptions {
  marketplace: Marketplace;
  projectRoot: string;
  forceRefresh?: boolean;
}

export interface ResolveMarketplaceResult {
  marketplace: Marketplace;
  localPath: string;
  catalog: PluginCatalog | null;
}

export class ResolveMarketplaceUseCase {
  constructor(
    private readonly pluginFetcher: PluginFetcher,
    private readonly catalogRepo: PluginCatalogRepository
  ) {}

  async execute(options: ResolveMarketplaceOptions): Promise<ResolveMarketplaceResult> {
    const cacheDir = marketplaceCacheDir(options.projectRoot, options.marketplace.name);
    const localPath = await this.pluginFetcher.fetch(options.marketplace.source, cacheDir, {
      forceRefresh: options.forceRefresh ?? false,
    });
    const catalog = await this.catalogRepo.load(localPath);
    return { marketplace: options.marketplace, localPath, catalog };
  }
}
