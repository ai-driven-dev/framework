import type { MarketplaceView } from "./marketplace-view.js";

export interface StaleMarketplace {
  readonly name: string;
}

/** Which registered marketplaces went stale, and every one registered. */
export interface MarketplaceCatalogs {
  readonly stale: readonly StaleMarketplace[];
  readonly marketplaces: readonly MarketplaceView[];
}
