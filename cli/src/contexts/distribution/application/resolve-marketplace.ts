import { fetchedMarketplaceDir } from "../../../kernel/paths.js";
import type { PluginCatalog } from "../domain/catalog.js";
import type { Marketplace } from "../domain/marketplace.js";
import type { PluginCatalogRepository } from "../ports/plugin-catalog-repository.js";
import type { FetchMarketplaceSource } from "./fetch-marketplace-source.js";

export interface ResolveMarketplaceCommand {
  marketplace: Marketplace;
  projectRoot: string;
  forceRefresh?: boolean;
}

export interface ResolveMarketplaceResult {
  marketplace: Marketplace;
  localPath: string;
  catalog: PluginCatalog | null;
}

/** Resolving a marketplace to a local path and catalog. */
export class ResolveMarketplace {
  constructor(
    private readonly fetchMarketplaceSource: FetchMarketplaceSource,
    private readonly catalogRepo: PluginCatalogRepository,
    private readonly userConfigDir?: () => string
  ) {}

  async execute(options: ResolveMarketplaceCommand): Promise<ResolveMarketplaceResult> {
    const cacheDir = this.cacheDirOf(options.marketplace, options.projectRoot);
    const localPath = await this.fetchMarketplaceSource.execute({
      marketplace: options.marketplace,
      cacheDir,
      fetchOptions: { forceRefresh: options.forceRefresh ?? false },
    });
    const catalog = await this.catalogRepo.load(localPath);
    return { marketplace: options.marketplace, localPath, catalog };
  }

  cacheDirOf(marketplace: Marketplace, projectRoot: string): string {
    return fetchedMarketplaceDir(marketplace, projectRoot, this.userConfigDir?.());
  }
}
