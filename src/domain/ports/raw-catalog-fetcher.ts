import type { PluginSourceGitHub } from "../models/plugin-source.js";

export interface RawCatalogFetcher {
  fetchCatalog(source: PluginSourceGitHub, catalogPath: string, cacheDir: string): Promise<string>;
}
