import type { ToolId } from "../../../../shared/domain/tool.js";

/** Which plugins aidd installed in each host's own server, by id. A server holds plugins from
 * anyone, so this is the only proof a plugin is aidd's to refresh or remove. */
export interface ServerPluginLedger {
  load(): Promise<Map<ToolId, readonly string[]>>;
  /** Saving none removes what was kept. */
  save(owned: ReadonlyMap<ToolId, readonly string[]>): Promise<void>;
}
