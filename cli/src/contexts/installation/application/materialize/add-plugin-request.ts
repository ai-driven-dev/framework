import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import type { PluginSource } from "../../../../shared/domain/plugin/source.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ProjectHooksProvenance } from "../../domain/plugins/plugin-entry.js";
import type { ProjectHooksGuard } from "../shared/assert-project-hooks-unchanged.js";
import type { BuiltMaterializationDeps } from "../shared/built-materialization-deps.js";

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
  hooksGuard?: ProjectHooksGuard;
}

export type AddPluginResult = { skipped: ReadonlySkipList; written?: number };

export interface PlacementDeps {
  fs: FileWriter & FileReader;
  built: BuiltMaterializationDeps;
}
