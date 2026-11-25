import type { PluginSourceGitHub } from "../../../shared/domain/plugin/source.js";

export interface RawCatalogFetcher {
  fetchCatalog(source: PluginSourceGitHub, catalogPath: string): Promise<string>;
}
