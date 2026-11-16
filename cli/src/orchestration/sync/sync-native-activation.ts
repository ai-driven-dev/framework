import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { SyncSettings, SyncSettingsResult } from "./sync-settings.js";

export interface SyncNativeActivationRequest {
  readonly projectRoot: string;
  readonly tools: ToolCatalog;
  /** Narrows activation to these marketplaces alone; omitted, every registered one is
   * re-driven. */
  readonly marketplaceNames?: readonly string[];
}

/** Re-drives native activation after a command changed what is registered. The shared
 * marketplace is never recreated here: only `sync` itself repopulates an empty registry. The
 * outcome is handed back whole, `failed` included, so the command only prints it. */
export class SyncNativeActivation {
  constructor(private readonly syncSettings: Pick<SyncSettings, "execute">) {}

  execute(request: SyncNativeActivationRequest): Promise<SyncSettingsResult> {
    return this.syncSettings.execute({
      projectRoot: request.projectRoot,
      tools: request.tools,
      marketplaceNames: request.marketplaceNames,
    });
  }
}
