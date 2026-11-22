import type { PluginPlacement } from "../../ports/tool-sections.js";
import type { PluginTranslators } from "../shared/built-materialization-deps.js";
import type { PluginTranslator } from "./plugin-translator.js";
import { resolveTranslator } from "./plugin-translator-factory.js";

/** `null` when the tool is not an AI tool, or has no plugins capability. */
export function resolvePluginTranslator(
  tool: { readonly kind: "ide" } | ({ readonly kind: "ai" } & PluginPlacement),
  translators: PluginTranslators
): PluginTranslator | null {
  if (tool.kind !== "ai") return null;
  const plugins = tool.plugins();
  return plugins === null ? null : resolveTranslator(plugins, translators);
}
