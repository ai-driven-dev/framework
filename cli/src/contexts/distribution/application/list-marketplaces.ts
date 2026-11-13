import type { Logger } from "../../../kernel/ports/logger.js";
import type { PluginCatalog } from "../domain/catalog.js";
import type { Marketplace } from "../domain/marketplace.js";
import type { MarketplaceRegistry } from "../ports/marketplace-registry.js";
import type { ResolveMarketplace } from "./resolve-marketplace.js";

export interface ListMarketplacesCommand {
  projectRoot: string;
  withCatalogs?: boolean;
}

export interface ListMarketplacesResult {
  marketplaces: readonly Marketplace[];
  catalogs?: Map<string, PluginCatalog>;
}

export class ListMarketplaces {
  constructor(
    private readonly registry: MarketplaceRegistry,
    private readonly resolveMarketplace?: ResolveMarketplace,
    private readonly logger?: Logger
  ) {}

  async execute(options: ListMarketplacesCommand): Promise<ListMarketplacesResult> {
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
    if (this.resolveMarketplace === undefined) return;
    try {
      const { catalog } = await this.resolveMarketplace.execute({
        marketplace,
        projectRoot,
        forceRefresh: true,
      });
      if (catalog !== null) catalogs.set(marketplace.name, catalog);
    } catch (err) {
      this.logger?.warn(`Skipping marketplace '${marketplace.name}': ${String(err)}`);
    }
  }
}
