import type { HintedMessage } from "../../../shared/domain/describe-error.js";
import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";

/** The plugin ref a removal is about to disable, and the project it is removed from. */
export interface PluginRefGuardQuery {
  readonly binary: string;
  readonly tool: { pluginEnablementIsMachineGlobal(): boolean };
  readonly ref: string;
  readonly marketplaceAlias: string;
  readonly projectRoot: string;
}

/** What a plugin removal asks the machine scope: who owns a ref, what guards it, and the claims it
 * lets go of. */
export interface PluginRemovalClaims {
  readonly home: string;
  isMachineOwned(toolId: ToolId, ref: string): Promise<boolean>;
  guardMessage(query: PluginRefGuardQuery): Promise<string | HintedMessage | undefined>;
  resolveCacheCandidate(
    cacheRoot: string,
    relativeSegments: string,
    label: string
  ): Promise<string | null>;
  detachNativeRefs(
    projectRoot: string,
    refsByTool: ReadonlyMap<ToolId, readonly string[]>
  ): Promise<void>;
  detachUserPlugin(toolId: AiToolId, name: string, projectRoot: string): Promise<void>;
}
