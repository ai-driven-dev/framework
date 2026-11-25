import type { PluginSource } from "../../../shared/domain/plugin/source.js";
import type { PluginCatalogEntry } from "./catalog.js";

/** A plugin a registered marketplace catalogues, with the source an installer can fetch it from. */
export interface PluginSourceMatch {
  readonly marketplaceName: string;
  /** Whether that marketplace is a github one. */
  readonly githubMarketplace: boolean;
  readonly entry: PluginCatalogEntry;
  readonly source: PluginSource;
}
