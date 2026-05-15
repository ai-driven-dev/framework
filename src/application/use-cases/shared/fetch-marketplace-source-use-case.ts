import type { Marketplace } from "../../../domain/models/marketplace.js";
import type { PluginSourceGitHub } from "../../../domain/models/plugin-source.js";
import type { PluginFetcher, PluginFetchOptions } from "../../../domain/ports/plugin-fetcher.js";
import type { RawCatalogFetcher } from "../../../domain/ports/raw-catalog-fetcher.js";

const CLAUDE_CATALOG_PATH = ".claude-plugin/marketplace.json";

export interface FetchMarketplaceSourceOptions {
  marketplace: Marketplace;
  cacheDir: string;
  fetchOptions?: PluginFetchOptions;
}

export class FetchMarketplaceSourceUseCase {
  constructor(
    private readonly pluginFetcher: PluginFetcher,
    private readonly rawCatalogFetcher?: RawCatalogFetcher
  ) {}

  async execute(options: FetchMarketplaceSourceOptions): Promise<string> {
    const { marketplace, cacheDir, fetchOptions } = options;
    if (marketplace.source.kind === "github" && this.rawCatalogFetcher !== undefined) {
      return this.rawCatalogFetcher.fetchCatalog(
        marketplace.source as PluginSourceGitHub,
        CLAUDE_CATALOG_PATH,
        cacheDir
      );
    }
    return this.pluginFetcher.fetch(marketplace.source, cacheDir, fetchOptions);
  }
}
