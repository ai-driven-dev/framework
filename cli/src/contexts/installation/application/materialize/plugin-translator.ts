import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import type { PluginSource } from "../../../../shared/domain/source.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import type { PluginTranslationMode } from "../../../tools/contract/tool-vocabulary.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ProjectHooksProvenance } from "../../domain/plugins/plugin-entry.js";
import type { ProjectHooksGuard } from "../shared/assert-project-hooks-unchanged.js";

/** Everything a translator needs to place one plugin. The optional fields default per strategy. */
export interface AddPluginRequest {
  dist: PluginDistribution;
  tool: AiToolProfile;
  source: PluginSource;
  projectRoot: string;
  manifest: Manifest;
  marketplace: string | undefined;
  previousMcpEntries?: ReadonlyMap<string, string>;
  userScopeDirTaken?: boolean;
  previousProjectHooks?: ProjectHooksProvenance;
  hooksGuard?: ProjectHooksGuard;
}

export type AddPluginResult = { skipped: ReadonlySkipList; written?: number };

/** A translator strategy contract, not a hexagonal port adapter. */
export interface PluginTranslator {
  readonly mode: PluginTranslationMode;

  /**
   * Returns a skip list: non-empty when the plugin carries components the tool cannot consume -
   * and, for strategies that track it, how many files were actually (re)written to disk.
   *
   * `previousMcpEntries` carries the plugin's previous entries when replacing an existing install,
   * for an idempotent re-merge of OpenCode MCP servers.
   */
  addPlugin(request: AddPluginRequest): Promise<AddPluginResult>;
}
