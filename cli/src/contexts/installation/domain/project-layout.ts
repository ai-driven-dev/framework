import { join } from "node:path";
import { AIDD_DIR } from "../../../shared/domain/layout/aidd-layout.js";

export const AIDD_CONFIG_FILENAME = "config.json";
export const PLUGIN_CACHE_SUBDIR = join(AIDD_DIR, "plugin-cache");

/** The manifest's filename, named once so every reader and writer of that file spells it the same. */
export const MANIFEST_FILENAME = "manifest.json";

/** Where the user-scope manifest lives: directly under `userConfigDir()`, never nested in an
 * `.aidd/` segment, since there is no project to hold one, and `marketplaces.json` and
 * `references.json` sit at that same root already. */
export function userManifestPath(userConfigDir: string): string {
  return join(userConfigDir, MANIFEST_FILENAME);
}
