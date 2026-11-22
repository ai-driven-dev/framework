import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import type { PluginTranslationMode } from "../../../tools/contract/tool-vocabulary.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ProjectHooksGuard } from "../shared/assert-project-hooks-unchanged.js";
import type { PlacementDeps } from "./add-plugin-request.js";
import { placeBuiltTreePlugin } from "./place-built-tree-plugin.js";
import { registerMarketplacePlugin } from "./register-marketplace-plugin.js";

export interface PluginRematerialization {
  readonly dist: PluginDistribution;
  readonly tool: AiToolProfile;
  readonly mode: PluginTranslationMode;
  readonly plugin: InstalledPlugin;
  readonly projectRoot: string;
  readonly manifest: Manifest;
  readonly hooksGuard?: ProjectHooksGuard;
}

/**
 * Re-registers a marketplace-sourced plugin the way its tool takes it: drops the existing
 * manifest entry and places the plugin again, so update and restore both end with the same
 * single entry an install would have produced.
 *
 * Returns how many files were actually (re)written: not the plugin's total file count: so
 * a no-op restore reports zero. `written` is undefined for a placement that writes no files, and
 * is reported as 0 rather than guessed.
 */
export async function rematerializePlugin(
  rematerialization: PluginRematerialization,
  deps: PlacementDeps
): Promise<number> {
  const { dist, tool, mode, plugin, projectRoot, manifest, hooksGuard = {} } = rematerialization;
  manifest.removePlugin(tool.toolId, plugin.name);
  const request = {
    dist,
    tool,
    source: plugin.source,
    projectRoot,
    manifest,
    marketplace: plugin.marketplace,
    previousMcpEntries: plugin.mcpEntries,
    userScopeDirTaken: false,
    previousProjectHooks: plugin.projectHooks,
    hooksGuard,
  };
  if (mode === "marketplace") {
    registerMarketplacePlugin(request);
    return 0;
  }
  return (await placeBuiltTreePlugin(request, deps)).written ?? 0;
}
