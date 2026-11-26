import type { PluginSource } from "../../../shared/domain/plugin/source.js";

export interface PluginCatalogEntry {
  name: string;
  source: PluginSource;
  description?: string;
  version?: string;
  recommended: boolean;
  strict: boolean;
}

export interface PluginCatalog {
  name?: string;
  version?: string;
  plugins: readonly PluginCatalogEntry[];
}
