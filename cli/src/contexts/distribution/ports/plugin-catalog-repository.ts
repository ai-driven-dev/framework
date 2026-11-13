import type { PluginCatalog } from "../domain/catalog.js";

export interface PluginCatalogRepository {
  load(frameworkPath: string): Promise<PluginCatalog | null>;
}
