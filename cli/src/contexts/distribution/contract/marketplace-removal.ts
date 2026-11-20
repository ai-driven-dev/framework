import type { Scope } from "../../../shared/domain/scope.js";

/** A registered marketplace a removal found: what it is called and which scope holds it. */
export interface RemovableMarketplace {
  readonly name: string;
  readonly scope: Scope;
}

export interface MarketplaceRemovalResult {
  marketplace: { readonly name: string };
  removedPluginCount: number;
  orphanCount: number;
}

/** A user-scope marketplace a removal found, with a fingerprint of the source it was found with. */
export interface FoundUserMarketplace extends RemovableMarketplace {
  readonly scope: "user";
  readonly fingerprint: string;
}
