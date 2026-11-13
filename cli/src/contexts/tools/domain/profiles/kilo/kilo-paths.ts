/** Paths Kilo scans in a project. Kept apart from the profile so the build contract and the
 * later hooks bridge share one declaration rather than duplicate Kilo's plugin layout. */

import { KiloDualConfigError } from "../../../../../kernel/errors.js";
import type { McpOutputPathCandidates } from "../../sections/mcp-section.js";

export const KILO_DIRECTORY = ".kilo/";
export const KILO_PLUGIN_DIR = `${KILO_DIRECTORY}plugin/`;
export const KILO_PLUGIN_ENTRY_BASENAME = "kilo-plugin.js";
export const KILO_PROJECT_CONFIG_JSON = `${KILO_DIRECTORY}kilo.json`;
export const KILO_PROJECT_CONFIG_JSONC = `${KILO_DIRECTORY}kilo.jsonc`;

const KILO_LEGACY_CONFIG_JSON = "kilo.json";
const KILO_LEGACY_CONFIG_JSONC = "kilo.jsonc";

/** Every config file Kilo may keep, relative to the project root. */
export const KILO_CONFIG_CANDIDATES = [
  KILO_PROJECT_CONFIG_JSON,
  KILO_PROJECT_CONFIG_JSONC,
  KILO_LEGACY_CONFIG_JSON,
  KILO_LEGACY_CONFIG_JSONC,
] as const;

/** Prefer the config beside Kilo's project artifacts. Existing root-level configuration stays
 * user-owned and is reused rather than creating a second configuration variant. */
export function chooseKiloConfigPath(exists: (relPath: string) => boolean): string {
  const projectJson = exists(KILO_PROJECT_CONFIG_JSON);
  const projectJsonc = exists(KILO_PROJECT_CONFIG_JSONC);
  if (projectJson && projectJsonc) throw new KiloDualConfigError();
  if (projectJsonc) return KILO_PROJECT_CONFIG_JSONC;
  if (projectJson) return KILO_PROJECT_CONFIG_JSON;

  const legacyJson = exists(KILO_LEGACY_CONFIG_JSON);
  const legacyJsonc = exists(KILO_LEGACY_CONFIG_JSONC);
  if (legacyJson && legacyJsonc) throw new KiloDualConfigError();
  if (legacyJsonc) return KILO_LEGACY_CONFIG_JSONC;
  if (legacyJson) return KILO_LEGACY_CONFIG_JSON;
  return KILO_PROJECT_CONFIG_JSONC;
}

/** The same order `chooseKiloConfigPath` applies, as data: project tier, then legacy root tier. */
export const KILO_OUTPUT_PATH_CANDIDATES: McpOutputPathCandidates = {
  tiers: [
    [KILO_PROJECT_CONFIG_JSON, KILO_PROJECT_CONFIG_JSONC],
    [KILO_LEGACY_CONFIG_JSON, KILO_LEGACY_CONFIG_JSONC],
  ],
  fallback: KILO_PROJECT_CONFIG_JSONC,
  conflict: () => {
    throw new KiloDualConfigError();
  },
};
