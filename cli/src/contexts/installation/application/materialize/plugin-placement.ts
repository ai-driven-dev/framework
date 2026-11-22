// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import type { PluginTranslationMode } from "../../../tools/contract/tool-vocabulary.js";
import type { PluginPlacement } from "../../ports/tool-sections.js";
import type { AddPluginRequest, AddPluginResult, PlacementDeps } from "./add-plugin-request.js";
import { placeBuiltTreePlugin } from "./place-built-tree-plugin.js";
import { registerMarketplacePlugin } from "./register-marketplace-plugin.js";

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
  return plugins.materializesFromBuiltTree() ? "flat" : "marketplace";
}

/** Places one plugin the way its tool takes it. The tool must have a placement mode. */
export async function placePlugin(
  request: AddPluginRequest & { tool: AiToolProfile },
  deps: PlacementDeps
): Promise<AddPluginResult> {
  return placementModeOf(request.tool) === "flat"
    ? placeBuiltTreePlugin(request, deps)
    : registerMarketplacePlugin(request);
}
