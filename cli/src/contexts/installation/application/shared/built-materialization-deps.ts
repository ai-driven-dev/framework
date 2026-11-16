import type { TranslateDistribution } from "../../../translate/contract/translate-distribution.js";
import type { InstallationMarketplaceRegistry } from "../../ports/marketplace-sources.js";
import type { BuiltMarketplaceEnsurer } from "./ensure-built-marketplace.js";

/** What re-materializing a plugin needs beyond its files: the build pipeline, to match what
 * install wrote, and the translation, for a source that has no built tree. */
export interface BuiltMaterializationDeps {
  ensureBuilt: BuiltMarketplaceEnsurer;
  marketplaceRegistry: InstallationMarketplaceRegistry;
  homedir: () => string;
  translate: TranslateDistribution;
}
