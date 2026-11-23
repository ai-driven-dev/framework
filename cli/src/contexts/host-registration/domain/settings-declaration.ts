import { asPlainObject } from "../../../shared/domain/reading/plain-object.js";
import { refOnHostName } from "./record/host-ref.js";

/** What a tool's settings answer about how its plugins register. */
interface ProofAnswering {
  requiresNativeProof(): boolean;
}

/** Whether a tool registers its plugins by its shared settings file alone, never needing the
 * host's proof. */
export const registersBySettingsFile = (settings: ProofAnswering): boolean =>
  !settings.requiresNativeProof();

/** Whether a tool's settings file enables only the refs the host itself proved. */
export const registersByProvenRefs = (settings: ProofAnswering): boolean =>
  settings.requiresNativeProof();

/** The refs a shared file enables: each recorded plugin of a marketplace this sync handles, keyed
 * by the entry key the tool names that marketplace by, none for a marketplace the tool cannot key. */
export function declaredSettingsRefs<M extends { readonly name: string }>(
  recorded: readonly { readonly plugin: string; readonly marketplace?: string | null }[],
  marketplaces: readonly M[],
  entryKeyOf: (marketplace: M) => string | null
): string[] {
  return recorded.flatMap(({ plugin, marketplace }) => {
    const handled = marketplaces.find((m) => m.name === marketplace);
    const key = handled === undefined ? null : entryKeyOf(handled);
    return key === null ? [] : [refOnHostName(plugin, key)];
  });
}

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

/** A parsed shared file without the entry a plugin has on a marketplace, or null when it held none.
 * The file the caller holds is left as it was. */
export function withoutEnabledPlugin(
  shared: Record<string, unknown>,
  enabledPluginsKey: string | null,
  plugin: { readonly name: string; readonly marketplace: string }
): Record<string, unknown> | null {
  if (enabledPluginsKey === null) return null;
  const { [refOnHostName(plugin.name, plugin.marketplace)]: removed, ...rest } =
    asPlainObject(shared[enabledPluginsKey]) ?? {};
  if (removed === undefined) return null;
  return { ...shared, [enabledPluginsKey]: rest };
}
