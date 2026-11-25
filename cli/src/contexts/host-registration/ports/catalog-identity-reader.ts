import type { MarketplaceCatalogIdentity } from "../domain/source/marketplace-source-conflict.js";
import type { CatalogProbeTool } from "./host-tool.js";

/** What a directory's own catalog declares about itself, or `undefined` when it carries no
 * readable catalog: silence, never a fact to invent. */
export interface CatalogIdentityReader {
  read(tool: CatalogProbeTool, dir: string): Promise<MarketplaceCatalogIdentity | undefined>;
}
