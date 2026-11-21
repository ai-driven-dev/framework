import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";
import type { NativeRegistrations } from "../domain/manifest/native-registrations.js";
import type { InstalledPlugin } from "../domain/plugins/installed-plugin.js";
import type { NativeHostTool } from "./tool-sections.js";

/** The plugin a removal asks its host about, and where. */
export interface PluginHostReach {
  readonly tool: NativeHostTool;
  readonly plugin: InstalledPlugin;
  readonly projectRoot: string;
  readonly registrations: NativeRegistrations | undefined;
}

/** What a project removal asks the host and the machine claims: whether the host lets the plugin
 * go, whether its ref may then leave the record, and the claims the removal lets go of. */
export interface ProjectPluginWithdrawalSteps {
  /** Refuses, before anything is deleted, a plugin the host cannot let go. */
  assertSource(source: PluginHostReach & { readonly toolId: AiToolId }): Promise<void>;
  /** `undefined` when the plugin carries no marketplace, else whether the host confirmed. */
  withdraw(reach: PluginHostReach): Promise<boolean | undefined>;
  /** The host confirmed the withdrawal, or it enables plugins machine-wide and nobody else holds `ref`. */
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
