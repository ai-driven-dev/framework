import { join } from "node:path";
import { AIDD_DIR } from "../../../shared/domain/layout/aidd-layout.js";
import { SOURCE_MARKETPLACE_RELATIVE } from "../../../shared/domain/plugin/canon-paths.js";

/** Where the catalog sits inside a fetched marketplace. */
export const MARKETPLACE_CATALOG_RELATIVE = SOURCE_MARKETPLACE_RELATIVE;

/** Where a framework may keep its catalog, in the order they are tried: the first one present
 * is the catalog. `plugin-root` entries name a bare subdirectory under `metadata.pluginRoot`;
 * `typed-source` entries carry a typed source each. */
export const CATALOG_LOCATIONS = [
  { format: "plugin-root", relative: ".plugin/marketplace.json" },
  { format: "typed-source", relative: MARKETPLACE_CATALOG_RELATIVE },
] as const;

export const MARKETPLACE_CACHE_SUBDIR = join(AIDD_DIR, "cache", "marketplaces");

export function marketplaceCacheDir(projectRoot: string, marketplaceName: string): string {
  return join(projectRoot, MARKETPLACE_CACHE_SUBDIR, marketplaceName);
}

/** Where a marketplace's fetched source lives: a user-scope one belongs to the whole machine, so a
 * run from any directory writes nothing there. */
export function fetchedMarketplaceDir(
  marketplace: { readonly name: string; readonly scope: string },
  projectRoot: string,
  userConfigDir: string | undefined
): string {
  return marketplace.scope === "user" && userConfigDir !== undefined
    ? join(userConfigDir, "cache", "marketplaces", marketplace.name)
    : marketplaceCacheDir(projectRoot, marketplace.name);
}
