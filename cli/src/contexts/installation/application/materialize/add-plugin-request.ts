import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import type { PluginSource } from "../../../../shared/domain/plugin/source.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ProjectHooksProvenance } from "../../domain/plugins/plugin-entry.js";
import type { PluginTranslation } from "../../ports/plugin/plugin-translation.js";
import type { ProjectHooksGuard } from "../shared/assert-project-hooks-unchanged.use-case.js";

/** Everything needed to place one plugin. The optional fields default per placement mode. */
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
  /** What an earlier install of the plugin recorded: what the new one no longer ships goes. */
  previousFiles?: ReadonlyMap<string, string>;
  hooksGuard?: ProjectHooksGuard;
}

export type AddPluginResult = { skipped: ReadonlySkipList; written?: number };

/** Places one plugin from its marketplace's built tree, or flat when none is registered. */
export type PlaceBuiltTree = (request: AddPluginRequest) => Promise<AddPluginResult>;

/** What placing an installed plugin again reaches: the home its user scope sits in, the
 * translation a source without a built tree takes, and the built-tree placement. */
export interface BuiltPlacement {
  readonly homedir: () => string;
  readonly translate: PluginTranslation;
  readonly placeBuiltTree: PlaceBuiltTree;
}
