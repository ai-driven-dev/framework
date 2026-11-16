import type { PluginSource } from "../../../shared/domain/source.js";
import type { PluginCatalogEntry } from "./catalog.js";

/** A plugin a registered marketplace catalogues, with the source an installer can fetch it from. */
export interface PluginSourceMatch {
  readonly marketplaceName: string;
  readonly entry: PluginCatalogEntry;
  readonly source: PluginSource;
}
