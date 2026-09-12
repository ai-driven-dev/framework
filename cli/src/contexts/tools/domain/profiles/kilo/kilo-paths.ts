/** Paths Kilo scans in a project. Kept apart from the profile so the build contract and the
 * later hooks bridge share one declaration rather than duplicate Kilo's plugin layout. */

export const KILO_DIRECTORY = ".kilo/";
export const KILO_HOOKS_DIR = `${KILO_DIRECTORY}hooks/`;
export const KILO_PLUGIN_DIR = `${KILO_DIRECTORY}plugin/`;
export const KILO_PLUGIN_ENTRY_BASENAME = "kilo-plugin.js";

export function makeKiloHooksBridgePath(plugin: string): string {
  return `${KILO_PLUGIN_DIR}${plugin}-hooks.js`;
}
