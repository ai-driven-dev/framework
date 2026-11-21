import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ProjectHooksGuard } from "../shared/remove-project-hooks.js";
import type { PluginTranslator } from "./plugin-translator.js";

export interface PluginRematerialization {
  readonly dist: PluginDistribution;
  readonly tool: AiToolProfile;
  readonly plugin: InstalledPlugin;
  readonly projectRoot: string;
  readonly manifest: Manifest;
  readonly hooksGuard?: ProjectHooksGuard;
}

/**
 * Re-registers a marketplace-sourced plugin through its resolved translator: drops the existing
 * manifest entry and lets the translator re-add it, so update and restore both end with the same
 * single entry an install would have produced.
 *
 * Returns how many files the translator actually (re)wrote: not the plugin's total file count: so
 * a no-op restore reports zero. `written` is undefined for a translator that writes no files, and
 * is reported as 0 rather than guessed.
 */
export async function materializeViaTranslator(
  translator: PluginTranslator,
  rematerialization: PluginRematerialization
): Promise<number> {
  const { dist, tool, plugin, projectRoot, manifest, hooksGuard = {} } = rematerialization;
  manifest.removePlugin(tool.toolId, plugin.name);
  const { written } = await translator.addPlugin({
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
  });
  return written ?? 0;
}
