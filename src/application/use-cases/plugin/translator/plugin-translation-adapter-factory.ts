import type { PluginsCapability } from "../../../../domain/capabilities/plugins-capability.js";
import type { FileWriter } from "../../../../domain/ports/file-writer.js";
import type { Hasher } from "../../../../domain/ports/hasher.js";
import { ModeAMarketplaceAdapter } from "./mode-a-marketplace-adapter.js";
import { ModeBFlatMaterializationAdapter } from "./mode-b-flat-materialization-adapter.js";
import type { PluginTranslationAdapter } from "./plugin-translation-adapter.js";

/**
 * Resolves the appropriate translation adapter for a given PluginsCapability.
 *
 * Routing priority:
 * 1. `installScope === "user"` → ModeBFlatMaterializationAdapter (Mode B, user-scope tools like Cursor)
 * 2. `translationMode === "marketplace"` → ModeAMarketplaceAdapter (Mode A: register in native config)
 * 3. `translationMode === "flat"` → ModeBFlatMaterializationAdapter (Mode B, project-scope flat tools like OpenCode)
 * 4. otherwise → null (neutral native or unsupported; no translation strategy applies)
 */
export function resolveTranslationAdapter(
  plugins: PluginsCapability,
  deps: { fs: FileWriter; hasher: Hasher; homedir: () => string }
): PluginTranslationAdapter | null {
  if (plugins.installScope === "user") {
    return new ModeBFlatMaterializationAdapter(deps.fs, deps.hasher, deps.homedir);
  }
  if (plugins.translationMode === "marketplace") {
    return new ModeAMarketplaceAdapter();
  }
  if (plugins.translationMode === "flat") {
    return new ModeBFlatMaterializationAdapter(deps.fs, deps.hasher, deps.homedir);
  }
  return null;
}
