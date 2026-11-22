import type { MarketplaceView } from "../contract/marketplace-view.js";
import type { MarketplaceRegistry } from "../ports/marketplace-registry.js";

export interface ListMarketplacesRequest {
  projectRoot: string;
}

export interface ListMarketplacesResult {
  marketplaces: readonly MarketplaceView[];
}

export class ListMarketplaces {
  constructor(private readonly registry: MarketplaceRegistry) {}

  async execute(options: ListMarketplacesRequest): Promise<ListMarketplacesResult> {
    return { marketplaces: await this.registry.list(options.projectRoot) };
  }
}
