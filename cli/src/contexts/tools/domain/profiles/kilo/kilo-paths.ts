/** Paths Kilo scans in a project. Kept apart from the profile so the build contract and the
 * later hooks bridge share one declaration rather than duplicate Kilo's plugin layout. */

import { join } from "node:path";
import { KiloDualConfigError } from "../../../../../kernel/errors.js";
import type { FileReader } from "../../../../../kernel/ports/file-reader.js";

export const KILO_DIRECTORY = ".kilo/";
export const KILO_HOOKS_DIR = `${KILO_DIRECTORY}hooks/`;
export const KILO_PLUGIN_DIR = `${KILO_DIRECTORY}plugin/`;
export const KILO_PLUGIN_ENTRY_BASENAME = "kilo-plugin.js";
export const KILO_PROJECT_CONFIG_JSON = `${KILO_DIRECTORY}kilo.json`;
export const KILO_PROJECT_CONFIG_JSONC = `${KILO_DIRECTORY}kilo.jsonc`;

const KILO_LEGACY_CONFIG_JSON = "kilo.json";
const KILO_LEGACY_CONFIG_JSONC = "kilo.jsonc";

export function makeKiloHooksBridgePath(plugin: string): string {
  return `${KILO_PLUGIN_DIR}${plugin}-hooks.js`;
}

/** Prefer the config beside Kilo's project artifacts. Existing root-level configuration stays
 * user-owned and is reused rather than creating a second configuration variant. */
export async function resolveKiloConfigPath(projectRoot: string, fs: FileReader): Promise<string> {
  const projectJson = await fs.fileExists(join(projectRoot, KILO_PROJECT_CONFIG_JSON));
  const projectJsonc = await fs.fileExists(join(projectRoot, KILO_PROJECT_CONFIG_JSONC));
  if (projectJson && projectJsonc) throw new KiloDualConfigError();
  if (projectJsonc) return KILO_PROJECT_CONFIG_JSONC;
  if (projectJson) return KILO_PROJECT_CONFIG_JSON;

  const legacyJson = await fs.fileExists(join(projectRoot, KILO_LEGACY_CONFIG_JSON));
  const legacyJsonc = await fs.fileExists(join(projectRoot, KILO_LEGACY_CONFIG_JSONC));
  if (legacyJson && legacyJsonc) throw new KiloDualConfigError();
  if (legacyJsonc) return KILO_LEGACY_CONFIG_JSONC;
  if (legacyJson) return KILO_LEGACY_CONFIG_JSON;
  return KILO_PROJECT_CONFIG_JSONC;
}
