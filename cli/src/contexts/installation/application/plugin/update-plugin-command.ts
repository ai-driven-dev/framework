import type { Scope } from "../../../../shared/domain/scope.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { ScopeRecords } from "../../contract/records/scope-records.js";
import type { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import type { ContainmentCheck } from "../../ports/plugin/user-plugin-materialization.js";
import type { RefreshNativeRef, RefSelection } from "./update-native-refs.js";

export interface UpdatePluginRequest {
  pluginNames?: string[];
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  scope?: Scope;
  /** Re-materialize at the same version: the source or the build changed, not the plugin's
   * version, as a new agent provider changes it. `sync --global` drives the machine-scope one. */
  rebuild?: boolean;
}

/** Runs a tool's file update once its preflight passed, so the scenario names a partial failure. */
export type AfterPreflight = (
  toolId: AiToolId,
  apply: () => Promise<RecordedPlugin>
) => Promise<RecordedPlugin>;

/** What a machine-scope update needs from the scenario running it. */
export interface MachinePluginUpdate {
  readonly isWithinUserScope: ContainmentCheck;
  readonly refreshNative: RefreshNativeRef;
  /** The refs a selection names, read from the machine records. */
  readonly refSelection: RefSelection & Pick<ScopeRecords, "loadRecords">;
  readonly afterPreflight: AfterPreflight;
}

/** An update of the plugins named; one carrying `machine` updates the machine-scope ones. */
export interface UpdatePluginCommand extends UpdatePluginRequest {
  readonly machine?: MachinePluginUpdate;
}
