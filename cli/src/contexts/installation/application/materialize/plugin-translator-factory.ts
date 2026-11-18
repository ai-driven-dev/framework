import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Hasher } from "../../../../shared/ports/hasher.js";
import type { PluginAnswers } from "../../../tools/contract/tool-profile.js";
import type { BuiltMaterializationDeps } from "../shared/built-materialization-deps.js";
import { BuiltTreeMaterializationTranslator } from "./built-tree-materialization-translator.js";
import { ModeAMarketplaceTranslator } from "./mode-a-marketplace-translator.js";
import type { PluginTranslator } from "./plugin-translator.js";

export interface TranslatorDeps {
  fs: FileWriter & FileReader;
  hasher: Hasher;
  built: BuiltMaterializationDeps;
}

/**
 * Resolves the translation adapter for a tool's plugin answers.
 *
 * A materializing tool copies the per-target BUILT tree verbatim, so installed bytes match the
 * build's own output; a raw local-path install falls back to flat materialization.
 */
export function resolveTranslator(plugins: PluginAnswers, deps: TranslatorDeps): PluginTranslator {
  if (plugins.materializesFromBuiltTree()) {
    return new BuiltTreeMaterializationTranslator(deps.fs, deps.hasher, deps.built);
  }
  return new ModeAMarketplaceTranslator();
}
