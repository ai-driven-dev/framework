import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { ScopeRecords, ToolRecord } from "../../contract/records/scope-records.js";
import type { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import type { NativeHostTool } from "../../ports/tool-sections.js";

/** A ref a machine claim holds on one tool. */
export interface ClaimedHostRef {
  readonly tool: AiToolId;
  readonly ref: string;
}

/** What a machine-scope removal asks the host, the caller's. `Proof` is the host's own proof that
 * a claimed ref is removable: installation only hands back what `proveClaimedRef` gave it. */
export interface ClaimedRefWithdrawal<Proof> {
  readonly proveClaimedRef: (
    registrations: ToolRecord,
    claim: ClaimedHostRef,
    projectRoot: string
  ) => Promise<Proof>;
  readonly uninstallProven: (proof: Proof) => Promise<void>;
}

/** What a removal asks of the record a plugin's ref sits in, the caller's to answer. */
export interface RecordedPluginRef extends ScopeRecords {
  /** The ref the record holds for the plugin, `undefined` when nothing was recorded for it. */
  recordedRef(registrations: ToolRecord | undefined, plugin: RecordedPlugin): string | undefined;
  /** The record without one ref, every other entry untouched. */
  withoutRef(registrations: ToolRecord, ref: string): ToolRecord;
}

/** The plugin a removal asks its host about, and where. */
export interface PluginHostReach {
  readonly tool: NativeHostTool;
  readonly plugin: RecordedPlugin;
  readonly projectRoot: string;
  readonly registrations: ToolRecord | undefined;
}

/** What a project removal asks the host and the machine claims, the caller's: whether the host
 * lets the plugin go, whether its ref may then leave the record, and the claims it lets go of. */
export interface ProjectPluginWithdrawalSteps extends RecordedPluginRef {
  /** Refuses, before anything is deleted, a plugin the host cannot let go. */
  assertSource(source: PluginHostReach & { readonly toolId: AiToolId }): Promise<void>;
  /** `undefined` when the plugin carries no marketplace, else whether the host confirmed. */
  withdraw(reach: PluginHostReach): Promise<boolean | undefined>;
  /** Whether the ref may leave the record once the host answered `confirmed`. */
  canDetachRef(ref: {
    readonly toolId: AiToolId;
    readonly tool: NativeHostTool;
    readonly confirmed: boolean | undefined;
    readonly ref: string;
  }): Promise<boolean>;
  detachNativeRefs(
    projectRoot: string,
    refsByTool: ReadonlyMap<ToolId, readonly string[]>
  ): Promise<void>;
  detachUserPlugin(toolId: AiToolId, name: string, projectRoot: string): Promise<void>;
}
