import type { MarketplaceView } from "../../contract/marketplace-view.js";
import type { MarketplaceCachePort } from "../../ports/marketplace-cache.js";
import type { MarketplaceRegistry } from "../../ports/marketplace-registry.js";
import type { RefreshMarketplaceRequest } from "./refresh-marketplace.use-case.js";

/** The marketplaces a refresh covers, their cache cleared first when forced. */
export class ListMarketplacesToRefresh {
  constructor(
    private readonly registry: MarketplaceRegistry,
    private readonly cache: MarketplaceCachePort
  ) {}

  async execute(request: RefreshMarketplaceRequest): Promise<readonly MarketplaceView[]> {
    if (request.force) await this.cache.clear(request.name);
    const all = await this.registry.list(request.projectRoot);
    return request.name ? all.filter((m) => m.name === request.name) : all;
  }
}
