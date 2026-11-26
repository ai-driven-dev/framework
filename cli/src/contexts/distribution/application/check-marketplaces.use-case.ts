import { STALE_MAX_DAYS_DEFAULT } from "../contract/marketplace.js";
import type { MarketplaceCatalogs } from "../contract/marketplace-catalogs.js";
import { isMarketplaceStale } from "../domain/marketplace.js";
import type { MarketplaceRegistry } from "../ports/marketplace-registry.js";

export interface CheckMarketplacesRequest {
  projectRoot: string;
  staleMaxDays?: number;
}

/** Which registered marketplaces went stale, next to every one registered. */
export class CheckMarketplaces {
  constructor(private readonly registry: MarketplaceRegistry) {}

  async execute(command: CheckMarketplacesRequest): Promise<MarketplaceCatalogs> {
    const maxDays = command.staleMaxDays ?? STALE_MAX_DAYS_DEFAULT;
    const marketplaces = await this.registry.list(command.projectRoot);
    const now = Date.now();
    const stale = marketplaces.filter((m) => isMarketplaceStale(m, now, maxDays));
    return { stale, marketplaces };
  }
}
