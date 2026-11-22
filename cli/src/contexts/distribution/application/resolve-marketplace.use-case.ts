import type { PluginCatalog } from "../contract/catalog.js";
import type { Marketplace } from "../domain/marketplace.js";
import { fetchedMarketplaceDir } from "../domain/marketplace-cache-paths.model.js";
import type { PluginCatalogRepository } from "../ports/plugin-catalog-repository.js";
import type { FetchMarketplaceSource } from "./fetch-marketplace-source.use-case.js";

/** What resolving reads of a marketplace: its name, where it is fetched from and its scope. */
export type ResolvableMarketplace = Pick<Marketplace, "name" | "source" | "scope">;

export interface ResolveMarketplaceRequest {
  marketplace: ResolvableMarketplace;
  projectRoot: string;
  forceRefresh?: boolean;
}

export interface ResolveMarketplaceResult {
  marketplace: ResolvableMarketplace;
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

  async execute(options: ResolveMarketplaceRequest): Promise<ResolveMarketplaceResult> {
    const cacheDir = this.cacheDirOf(options.marketplace, options.projectRoot);
    const localPath = await this.fetchMarketplaceSource.execute({
      marketplace: options.marketplace,
      cacheDir,
      fetchOptions: { forceRefresh: options.forceRefresh ?? false },
    });
    const catalog = await this.catalogRepo.load(localPath);
    return { marketplace: options.marketplace, localPath, catalog };
  }

  private cacheDirOf(marketplace: ResolvableMarketplace, projectRoot: string): string {
    return fetchedMarketplaceDir(marketplace, projectRoot, this.userConfigDir?.());
  }
}
