import type { ToolId } from "../../../shared/domain/tool.js";

/** Where one scope keeps the claims on each tool's native refs, as the record held them. */
export interface PluginClaimsRepository {
  load(): Promise<Map<ToolId, unknown>>;
  /** Saving none removes what was kept. */
  save(claims: ReadonlyMap<ToolId, unknown>): Promise<void>;
}
