import type { PluginAnswers } from "../../../tools/contract/tool-profile.js";
import type { PluginTranslators } from "../shared/built-materialization-deps.js";
import type { PluginTranslator } from "./plugin-translator.js";

/**
 * Picks the translation adapter for a tool's plugin answers.
 *
 * A materializing tool copies the per-target BUILT tree verbatim, so installed bytes match the
 * build's own output; a raw local-path install falls back to flat materialization.
 */
export function resolveTranslator(
  plugins: PluginAnswers,
  translators: PluginTranslators
): PluginTranslator {
  return plugins.materializesFromBuiltTree() ? translators.builtTree : translators.marketplace;
}
