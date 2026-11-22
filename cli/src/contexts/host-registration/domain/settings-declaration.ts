import { asPlainObject } from "../../../shared/domain/reading/plain-object.js";

/** A parsed shared settings file without its marketplaces declaration, or null when it declared
 * none. The file the caller holds is left as it was. */
export function withoutMarketplaces(
  shared: Record<string, unknown>,
  settingsKey: string
): Record<string, unknown> | null {
  if (!(settingsKey in shared)) return null;
  const rest = { ...shared };
  delete rest[settingsKey];
  return rest;
}

/** A parsed shared file with each ref not yet enabled added as enabled, or null when there is
 * nothing to add: every ref already there, or a tool that enables no plugin in this file. The file
 * the caller holds is left as it was. */
export function withEnabledPlugins(
  shared: Record<string, unknown>,
  enabledPluginsKey: string | null,
  refs: readonly string[]
): Record<string, unknown> | null {
  if (enabledPluginsKey === null) return null;
  const existing = asPlainObject(shared[enabledPluginsKey]) ?? {};
  const toAdd: Record<string, boolean> = {};
  for (const ref of refs) if (!(ref in existing)) toAdd[ref] = true;
  if (Object.keys(toAdd).length === 0) return null;
  return { ...shared, [enabledPluginsKey]: { ...existing, ...toAdd } };
}
