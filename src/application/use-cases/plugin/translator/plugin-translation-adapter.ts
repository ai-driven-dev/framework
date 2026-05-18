import type { Manifest } from "../../../../domain/models/manifest.js";
import type { PluginDistribution } from "../../../../domain/models/plugin-distribution.js";
import type { PluginSource } from "../../../../domain/models/plugin-source.js";
import type { PluginTranslationMode } from "../../../../domain/models/plugin-translation-mode.js";
import type { AiToolId } from "../../../../domain/models/tool-ids.js";

/**
 * Contract implemented by both translation strategy adapters.
 *
 * This interface is a translator strategy contract (not a hexagonal port adapter).
 * It lives in `application/use-cases/plugin/translator/` following the sub-use-case
 * subdir pattern established by `6-capability-sub-use-cases.md`.
 */
export interface PluginTranslationAdapter {
  /** Discriminant identifying which translation strategy this adapter implements. */
  readonly mode: PluginTranslationMode;

  /**
   * Add a plugin for a specific tool, writing files and/or registering the plugin reference
   * in the manifest according to this adapter's strategy.
   */
  addPlugin(
    dist: PluginDistribution,
    toolId: AiToolId,
    source: PluginSource,
    projectRoot: string,
    manifest: Manifest,
    marketplace: string | undefined,
    docsDir: string
  ): Promise<void>;
}
