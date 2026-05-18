import type { PluginsCapability } from "../../../../domain/capabilities/plugins-capability.js";
import type { FileWriter } from "../../../../domain/ports/file-writer.js";
import type { Hasher } from "../../../../domain/ports/hasher.js";
import { ModeAMarketplaceAdapter } from "./mode-a-marketplace-adapter.js";
import { ModeBFlatMaterializationAdapter } from "./mode-b-flat-materialization-adapter.js";
import type { PluginTranslationAdapter } from "./plugin-translation-adapter.js";

/**
 * Resolves the appropriate translation adapter for a given PluginsCapability.
 *
 * Reads `plugins.translationMode` as the single routing decision point:
 * - `"marketplace"` → ModeAMarketplaceAdapter (Mode A: register in native config)
 * - `"flat"` → ModeBFlatMaterializationAdapter (Mode B: materialize files on disk)
 * - `null` → null (neutral native or unsupported; no translation strategy applies)
 */
export function resolveTranslationAdapter(
  plugins: PluginsCapability,
  deps: { fs: FileWriter; hasher: Hasher }
): PluginTranslationAdapter | null {
  if (plugins.translationMode === "marketplace") {
    return new ModeAMarketplaceAdapter();
  }
  if (plugins.translationMode === "flat") {
    return new ModeBFlatMaterializationAdapter(deps.fs, deps.hasher);
  }
  return null;
}
