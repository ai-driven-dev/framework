import { Plugin } from "../../../../domain/models/plugin.js";
import type { PluginDistribution } from "../../../../domain/models/plugin-distribution.js";
import type { PluginSource } from "../../../../domain/models/plugin-source.js";
import type { AiToolId } from "../../../../domain/models/tool-ids.js";
import type { Manifest } from "../../../../domain/models/manifest.js";
import type { PluginTranslationAdapter } from "./plugin-translation-adapter.js";

/**
 * Mode A — Marketplace + plugins.
 *
 * This class is a translator adapter (not a hexagonal port adapter).
 * Registers the framework marketplace in the tool's native config file
 * (extraKnownMarketplaces / enabledPlugins) using MarketplaceSettings.
 * Used by tools with native marketplace support: Claude, Copilot VSCode, Codex, Cursor.
 *
 * Plugin files are NOT materialized on disk. Instead, a plugin reference is added to
 * the manifest with an empty files set — the marketplace sync handles the rest.
 */
export class ModeAMarketplaceAdapter implements PluginTranslationAdapter {
  readonly mode = "marketplace" as const;

  async addPlugin(
    dist: PluginDistribution,
    toolId: AiToolId,
    source: PluginSource,
    _projectRoot: string,
    manifest: Manifest,
    marketplace: string | undefined,
    _docsDir: string
  ): Promise<void> {
    manifest.addPlugin(toolId, Plugin.fromDistribution(dist, source, [], new Map(), marketplace));
  }
}
