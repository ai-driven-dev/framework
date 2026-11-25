import type { PluginSource } from "../../../shared/domain/plugin/source.js";
import type { Scope } from "../../../shared/domain/scope.js";

/** A registered marketplace as distribution hands it out: what a caller reads, nothing it can change. */
export interface MarketplaceView {
  readonly name: string;
  readonly source: PluginSource;
  readonly scope: Scope;
  readonly version?: string;
  readonly addedAt: string;
  readonly lastFetched?: string;
}
