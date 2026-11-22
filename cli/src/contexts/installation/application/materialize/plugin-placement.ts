import type { PluginTranslationMode } from "../../../tools/contract/tool-vocabulary.js";
import type { PluginPlacement } from "../../ports/tool-sections.js";

/**
 * How a tool takes a plugin: a materializing tool copies the per-target BUILT tree, so installed
 * bytes match the build's own output; any other plugin-capable tool registers a marketplace
 * reference. `null` when the tool is not an AI tool, or has no plugins capability.
 */
export function placementModeOf(
  tool: { readonly kind: "ide" } | ({ readonly kind: "ai" } & PluginPlacement)
): PluginTranslationMode | null {
  if (tool.kind !== "ai") return null;
  const plugins = tool.plugins();
  if (plugins === null) return null;
  return plugins.materializesFromBuiltTree() ? "built-tree" : "marketplace";
}
