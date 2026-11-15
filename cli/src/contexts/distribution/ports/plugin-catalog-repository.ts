import type { PluginCatalog } from "../contract/catalog.js";

export interface PluginCatalogRepository {
  load(frameworkPath: string): Promise<PluginCatalog | null>;
}
