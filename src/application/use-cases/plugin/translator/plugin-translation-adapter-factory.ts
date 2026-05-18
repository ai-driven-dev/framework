import type { PluginsCapability } from "../../../../domain/capabilities/plugins-capability.js";
import type { FileWriter } from "../../../../domain/ports/file-writer.js";
import type { Hasher } from "../../../../domain/ports/hasher.js";
import type { MarketplaceSyncSettingsUseCase } from "../../marketplace/marketplace-sync-settings-use-case.js";
import { ModeAMarketplaceAdapter } from "./mode-a-marketplace-adapter.js";
import { ModeBFlatMaterializationAdapter } from "./mode-b-flat-materialization-adapter.js";
import type { PluginTranslationAdapter } from "./plugin-translation-adapter.js";

/**
 * Resolves the appropriate translation adapter for a given PluginsCapability.
 *
 * - `mode === "native"` AND `marketplaceSettings != null` → ModeAMarketplaceAdapter
 * - `mode === "flat"` → ModeBFlatMaterializationAdapter
 * - `mode === "native"` AND `marketplaceSettings === null` → null (neutral native, no sync)
 * - `mode === "unsupported"` → null (tool has no plugin capability)
 *
 * Returns null when no translation strategy applies for the given capability.
 */
export function resolveTranslationAdapter(
  plugins: PluginsCapability,
  deps: { marketplaceSyncSettings: MarketplaceSyncSettingsUseCase; fs: FileWriter; hasher: Hasher }
): PluginTranslationAdapter | null {
  if (plugins.mode === "native" && plugins.marketplaceSettings !== null) {
    return new ModeAMarketplaceAdapter(deps.marketplaceSyncSettings);
  }
  if (plugins.mode === "flat") {
    return new ModeBFlatMaterializationAdapter(deps.fs, deps.hasher);
  }
  return null;
}
