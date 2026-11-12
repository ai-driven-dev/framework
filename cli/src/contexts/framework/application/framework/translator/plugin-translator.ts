import type { PluginSource } from "../../../../../kernel/source.js";
import type { AiToolProfile } from "../../../../tools/contract/tool-profile.js";
import type { PluginTranslationMode } from "../../../../tools/contract/tool-vocabulary.js";
import type { PluginDistribution } from "../../../../translate/domain/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../../translate/domain/plugin-translation-skip.js";
import type { Manifest } from "../../../domain/manifest.js";
import type { ProjectHooksProvenance } from "../../../domain/plugins/installed-plugin.js";
import type { ProjectHooksGuard } from "../../shared/remove-project-hooks.js";

/** A translator strategy contract, not a hexagonal port adapter. */
export interface PluginTranslator {
  readonly mode: PluginTranslationMode;

  /**
   * Returns a skip list — non-empty when the plugin carries components the tool cannot consume —
   * and, for strategies that track it, how many files were actually (re)written to disk.
   *
   * `previousMcpEntries` carries the plugin's previous entries when replacing an existing install,
   * for an idempotent re-merge of OpenCode MCP servers.
   */
  addPlugin(
    dist: PluginDistribution,
    tool: AiToolProfile,
    source: PluginSource,
    projectRoot: string,
    manifest: Manifest,
    marketplace: string | undefined,
    previousMcpEntries?: ReadonlyMap<string, string>,
    userScopeDirTaken?: boolean,
    previousProjectHooks?: ProjectHooksProvenance,
    hooksGuard?: ProjectHooksGuard
  ): Promise<{ skipped: ReadonlySkipList; written?: number }>;
}
