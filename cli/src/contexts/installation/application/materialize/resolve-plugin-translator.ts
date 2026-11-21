import type { PluginPlacement } from "../../ports/tool-sections.js";
import type { PluginTranslator } from "./plugin-translator.js";
import { resolveTranslator, type TranslatorDeps } from "./plugin-translator-factory.js";

/** `null` when the tool is not an AI tool, or has no plugins capability. */
export function resolvePluginTranslator(
  tool: { readonly kind: "ide" } | ({ readonly kind: "ai" } & PluginPlacement),
  deps: TranslatorDeps
): PluginTranslator | null {
  if (tool.kind !== "ai") return null;
  const plugins = tool.plugins();
  return plugins === null ? null : resolveTranslator(plugins, deps);
}
