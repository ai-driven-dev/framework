import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { SyncSettings, SyncSettingsResult } from "./sync-settings.js";

export interface SyncNativeActivationRequest {
  readonly projectRoot: string;
  readonly tools: ToolCatalog;
  /** Narrows activation to these marketplaces alone; omitted, every registered one is
   * re-driven. */
  readonly marketplaceNames?: readonly string[];
}

/** What the activation reported, plus the verdict: one refused scope fails the activation. */
export interface SyncNativeActivationOutcome extends SyncSettingsResult {
  readonly failed: boolean;
}

/** Re-drives native activation after a command changed what is registered. The shared
 * marketplace is never recreated here: only `sync` itself repopulates an empty registry. It
 * decides whether the activation failed; the command only prints the outcome and exits on it. */
export class SyncNativeActivation {
  constructor(private readonly syncSettings: Pick<SyncSettings, "execute">) {}

  async execute(request: SyncNativeActivationRequest): Promise<SyncNativeActivationOutcome> {
    const result = await this.syncSettings.execute({
      projectRoot: request.projectRoot,
      tools: request.tools,
      marketplaceNames: request.marketplaceNames,
    });
    return { ...result, failed: result.errors.length > 0 };
  }
}
