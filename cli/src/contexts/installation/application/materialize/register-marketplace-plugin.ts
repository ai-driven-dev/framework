import type { ReadonlySkipList } from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { PluginPlacement } from "../../ports/tool-sections.js";
import { resolveScopeForInstall } from "../plugin/plugin-target-resolution.js";
import type { AddPluginRequest } from "./add-plugin-request.js";

/**
 * A marketplace registration, for a tool with native marketplace support.
 *
 * Files are NOT materialized on disk: a plugin reference is added to the manifest with an empty
 * files set, and `SyncSettings` does the rest: driving the tool's own CLI where
 * `nativeActivation` is declared, writing the enabled-plugins key directly where it is not.
 */
export function registerMarketplacePlugin(
  request: Omit<AddPluginRequest, "tool"> & { tool: PluginPlacement }
): { skipped: ReadonlySkipList } {
  const { dist, tool, source, manifest, marketplace } = request;
  manifest.addPlugin(
    tool.toolId,
    InstalledPlugin.fromDistribution({
      dist,
      source,
      files: [],
      scope: resolveScopeForInstall(tool),
      componentPaths: new Map(),
      marketplace,
    })
  );
  return { skipped: [] };
}
