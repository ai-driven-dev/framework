import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import type { PluginSource } from "../../../../shared/domain/source.js";
import type { Manifest } from "../../domain/manifest.js";
import { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { PluginPlacement } from "../../ports/tool-sections.js";
import { resolveScopeForInstall } from "../plugin/plugin-target-resolution.js";
import type { PluginTranslator } from "./plugin-translator.js";

/**
 * Mode A: a marketplace registration, for a tool with native marketplace support.
 *
 * Files are NOT materialized on disk: a plugin reference is added to the manifest with an empty
 * files set, and `SyncSettings` does the rest: driving the tool's own CLI where
 * `nativeActivation` is declared, writing the enabled-plugins key directly where it is not.
 */
export class ModeAMarketplaceTranslator implements PluginTranslator {
  readonly mode = "marketplace" as const;

  async addPlugin(
    dist: PluginDistribution,
    tool: PluginPlacement,
    source: PluginSource,
    _projectRoot: string,
    manifest: Manifest,
    marketplace: string | undefined
  ): Promise<{ skipped: ReadonlySkipList }> {
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
}
