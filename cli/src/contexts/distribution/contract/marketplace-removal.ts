import type { MarketplaceScope } from "../../../shared/domain/scope.js";

/** A registered marketplace a removal found: what it is called and which scope holds it. */
export interface RemovableMarketplace {
  readonly name: string;
  readonly scope: MarketplaceScope;
}

export interface MarketplaceRemovalResult {
  marketplace: { readonly name: string };
  removedPluginCount: number;
  orphanCount: number;
}
