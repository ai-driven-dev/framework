import type { Scope } from "../../../shared/domain/scope.js";
import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";

/** A plugin the installation removed, as far as a claim over it needs to know. */
export interface RemovedPlugin {
  readonly toolId: AiToolId;
  readonly plugin: { readonly name: string; readonly scope: Scope };
}

/** What removed plugins left claimed outside the installation record: the host's plugin
 * references, by tool, and the plugins themselves. */
export interface PluginClaims {
  readonly nativeRefs: ReadonlyMap<ToolId, readonly string[]>;
  readonly plugins: readonly RemovedPlugin[];
}

/** Lets go of the claims removed plugins held. The claims belong to another context, so the
 * installation is handed this and never reaches them itself. */
export type DetachPluginClaims = (projectRoot: string, claims: PluginClaims) => Promise<void>;
