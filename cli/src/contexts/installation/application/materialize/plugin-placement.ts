import type { PluginTranslationMode } from "../../../tools/contract/tool-vocabulary.js";
import type { PluginPlacement } from "../../ports/tool-sections.js";

/** Whether a tool takes a plugin's hooks into the project's own hooks file. */
export function deliversHooksToProject(tool: PluginPlacement): boolean {
  return tool.plugins()?.deliversHooksToProject() ?? false;
}

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

/**
 * The mode a plugin is rematerialized in from its built tree, `null` when it is translated
 * instead: it was installed from a marketplace, or the tool takes its hooks into the project
 * and `takesHooks` allows it.
 */
export function builtTreeModeOf(
  tool: Parameters<typeof placementModeOf>[0] & PluginPlacement,
  marketplace: string | undefined,
  takesHooks = true
): PluginTranslationMode | null {
  const mode = placementModeOf(tool);
  if (mode === null) return null;
  return marketplace !== undefined || (takesHooks && deliversHooksToProject(tool)) ? mode : null;
}
