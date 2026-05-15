import type { NormalizedPlugin } from "../models/normalized-plugin.js";
import type { PluginCatalog } from "../models/plugin-catalog.js";

export interface PluginCatalogRepository {
  load(frameworkPath: string): Promise<PluginCatalog | null>;
  loadForeign(frameworkPath: string): Promise<NormalizedPlugin[]>;
}
