import type { Marketplace } from "../../../domain/models/marketplace.js";
import type { MarketplaceRegistry } from "../../../domain/ports/marketplace-registry.js";

export interface MarketplaceListOptions {
  projectRoot: string;
}

export interface MarketplaceListResult {
  marketplaces: readonly Marketplace[];
}

export class MarketplaceListUseCase {
  constructor(private readonly registry: MarketplaceRegistry) {}

  async execute(options: MarketplaceListOptions): Promise<MarketplaceListResult> {
    const marketplaces = await this.registry.list(options.projectRoot);
    return { marketplaces };
  }
}
