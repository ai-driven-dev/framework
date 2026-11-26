import type { ReadonlySkipList } from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import type { PluginPlacement } from "../../ports/tool-sections.js";
import { resolveScopeForInstall } from "../plugin/plugin-target-resolution.js";
import type { AddPluginRequest } from "./add-plugin-request.js";

/**
 * A marketplace registration, for a tool with native marketplace support.
 *
 * The plugin's own files are NOT materialized on disk: a plugin reference is added to the manifest,
 * recording only the files `kept` that the caller placed itself in the project, and `SyncSettings` does the rest: driving the tool's own CLI where
 * `nativeActivation` is declared, writing the enabled-plugins key directly where it is not.
 */
export function registerMarketplacePlugin(
  request: Omit<AddPluginRequest, "tool"> & {
    tool: PluginPlacement;
    /** What the plugin keeps in the project beside the registration, by path and digest. */
    kept?: ReadonlyMap<string, string>;
  }
): { skipped: ReadonlySkipList } {
  const { dist, tool, source, manifest, marketplace, kept = new Map() } = request;
  manifest.addPlugin(
    tool.toolId,
    RecordedPlugin.fromDistribution({
      dist,
      source,
      files: [],
      scope: resolveScopeForInstall(tool),
      componentPaths: new Map(),
      marketplace,
    }).withFiles(kept)
  );
  return { skipped: [] };
}
