import type { PluginSourceGitHub } from "../../../shared/domain/source.js";

export interface RawCatalogFetcher {
  fetchCatalog(source: PluginSourceGitHub, catalogPath: string, cacheDir: string): Promise<string>;
}
