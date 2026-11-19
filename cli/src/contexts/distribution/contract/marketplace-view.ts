import type { MarketplaceScope } from "../../../shared/domain/scope.js";
import type { PluginSource } from "../../../shared/domain/source.js";

/** A registered marketplace as distribution hands it out: what a caller reads, nothing it can change. */
export interface MarketplaceView {
  readonly name: string;
  readonly source: PluginSource;
  readonly scope: MarketplaceScope;
  readonly version?: string;
  readonly addedAt: string;
  readonly lastFetched?: string;
}
