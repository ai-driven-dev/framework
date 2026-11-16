import type { MarketplaceRegistry } from "../../../distribution/ports/marketplace-registry.js";
import type { TranslateDistribution } from "../../../translate/contract/translate-distribution.js";
import type { BuiltMarketplaceEnsurer } from "./ensure-built-marketplace.js";

/** What re-materializing a plugin needs beyond its files: the build pipeline, to match what
 * install wrote, and the translation, for a source that has no built tree. */
export interface BuiltMaterializationDeps {
  ensureBuilt: BuiltMarketplaceEnsurer;
  marketplaceRegistry: MarketplaceRegistry;
  homedir: () => string;
  translate: TranslateDistribution;
}
