import type { FileReader } from "../../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../../kernel/ports/file-writer.js";
import type { Hasher } from "../../../../../kernel/ports/hasher.js";
import type { MarketplaceRegistry } from "../../../../distribution/domain/ports/marketplace-registry.js";
import type { PluginAnswers } from "../../../../tools/contract/tool-profile.js";
import type { EnsureBuiltMarketplace } from "../../shared/ensure-built-marketplace-use-case.js";
import { BuiltTreeMaterializationTranslator } from "./built-tree-materialization-translator.js";
import { ModeAMarketplaceTranslator } from "./mode-a-marketplace-translator.js";
import type { PluginTranslator } from "./plugin-translator.js";

export interface TranslatorDeps {
  fs: FileWriter & FileReader;
  hasher: Hasher;
  homedir: () => string;
  ensureBuilt: EnsureBuiltMarketplace;
  marketplaceRegistry: MarketplaceRegistry;
}

/**
 * Resolves the translation adapter for a tool's plugin answers, or `null` when none applies.
 *
 * A materializing tool copies the per-target BUILT tree verbatim, so installed bytes match the
 * build's own output; a raw local-path install falls back to flat materialization.
 */
export function resolveTranslator(
  plugins: PluginAnswers,
  deps: TranslatorDeps
): PluginTranslator | null {
  if (plugins.kind === "flat" || (plugins.kind === "native" && plugins.requiresUserScope())) {
    return new BuiltTreeMaterializationTranslator(
      deps.fs,
      deps.hasher,
      deps.homedir,
      deps.ensureBuilt,
      deps.marketplaceRegistry
    );
  }
  if (plugins.kind === "native" && plugins.translatesAsMarketplace()) {
    return new ModeAMarketplaceTranslator();
  }
  return null;
}
