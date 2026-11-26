import type { ListMarketplaces } from "../../contexts/distribution/application/list-marketplaces.use-case.js";
import type { ResolveMarketplace } from "../../contexts/distribution/application/resolve-marketplace.use-case.js";
import type { PluginCatalog } from "../../contexts/distribution/contract/catalog.js";
import type { MarketplaceView } from "../../contexts/distribution/contract/marketplace-view.js";
import type { Logger } from "../../shared/ports/logger.js";

export interface ListMarketplaceCatalogsRequest {
  projectRoot: string;
}

export interface ListMarketplaceCatalogsResult {
  marketplaces: readonly MarketplaceView[];
  catalogs: Map<string, PluginCatalog>;
}

/** Lists the registered marketplaces with the catalog each one fetches today. A marketplace whose
 * catalog cannot be fetched is warned about and left out. */
export class ListMarketplaceCatalogs {
  constructor(
    private readonly marketplaces: Pick<ListMarketplaces, "execute">,
    private readonly resolveMarketplace: Pick<ResolveMarketplace, "execute">,
    private readonly logger: Logger
  ) {}

  async execute(request: ListMarketplaceCatalogsRequest): Promise<ListMarketplaceCatalogsResult> {
    const { marketplaces } = await this.marketplaces.execute(request);
    const catalogs = new Map<string, PluginCatalog>();
    for (const marketplace of marketplaces) {
      await this.fetchOne(marketplace, request.projectRoot, catalogs);
    }
    return { marketplaces, catalogs };
  }

  // @policy report-and-continue: a single unreachable catalog must not stop the listing.
  private async fetchOne(
    marketplace: MarketplaceView,
    projectRoot: string,
    catalogs: Map<string, PluginCatalog>
  ): Promise<void> {
    try {
      const { catalog } = await this.resolveMarketplace.execute({
        marketplace,
        projectRoot,
        forceRefresh: true,
      });
      if (catalog !== null) catalogs.set(marketplace.name, catalog);
    } catch (err) {
      this.logger.warn(`Skipping marketplace '${marketplace.name}': `, err);
    }
  }
}
