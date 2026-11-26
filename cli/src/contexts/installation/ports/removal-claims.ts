import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";

/** The machine claims a removal lets go of, supplied by the composition root. */
export interface RemovalClaims {
  readonly detachNativeRefs: (
    projectRoot: string,
    refsByTool: ReadonlyMap<ToolId, readonly string[]>
  ) => Promise<void>;
  readonly detachUserPlugin: (toolId: AiToolId, name: string, projectRoot: string) => Promise<void>;
}
