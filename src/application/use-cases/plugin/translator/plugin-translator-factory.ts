import type { PluginsCapability } from "../../../../domain/capabilities/plugins-capability.js";
import type { FileReader } from "../../../../domain/ports/file-reader.js";
import type { FileWriter } from "../../../../domain/ports/file-writer.js";
import type { Hasher } from "../../../../domain/ports/hasher.js";
import { ModeAMarketplaceTranslator } from "./mode-a-marketplace-translator.js";
import { ModeBFlatMaterializationTranslator } from "./mode-b-flat-materialization-translator.js";
import type { PluginTranslator } from "./plugin-translator.js";

/**
 * Resolves the appropriate translation adapter for a given PluginsCapability.
 *
 * Routing priority:
 * 1. `installScope === "user"` → ModeBFlatMaterializationTranslator (Mode B, user-scope tools like Cursor)
 * 2. `translationMode === "marketplace"` → ModeAMarketplaceTranslator (Mode A: register in native config)
 * 3. `translationMode === "flat"` → ModeBFlatMaterializationTranslator (Mode B, project-scope flat tools like OpenCode)
 * 4. otherwise → null (neutral native or unsupported; no translation strategy applies)
 */
export function resolveTranslator(
  plugins: PluginsCapability,
  deps: { fs: FileWriter & FileReader; hasher: Hasher; homedir: () => string }
): PluginTranslator | null {
  if (plugins.installScope === "user") {
    return new ModeBFlatMaterializationTranslator(deps.fs, deps.hasher, deps.homedir);
  }
  if (plugins.translationMode === "marketplace") {
    return new ModeAMarketplaceTranslator();
  }
  if (plugins.translationMode === "flat") {
    return new ModeBFlatMaterializationTranslator(deps.fs, deps.hasher, deps.homedir);
  }
  return null;
}
