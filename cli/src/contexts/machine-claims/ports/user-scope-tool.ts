import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";

/** A tool as far as the user-scope claims read it: its id and the directory its user-scope plugins
 * sit under, `null` when it declares none. The tools context owns the profile and the caller hands
 * over the real one, which satisfies this shape. */
export interface UserScopeTool {
  readonly toolId: AiToolId;
  plugins(): { userPluginsBaseDir(homedir: string): string | null } | null;
}

/** Whether enabling a plugin on this tool reaches every project on the machine at once. */
export interface PluginEnablementReach {
  pluginEnablementIsMachineGlobal(): boolean;
}

/** The tools as far as a run's machine claims read them, `null` for a tool that is not an AI tool. */
export interface ClaimingTools {
  aiProfileIfAny(
    toolId: ToolId
  ): (PluginEnablementReach & { nativeActivation(): { hostBinary(): string } | undefined }) | null;
}
