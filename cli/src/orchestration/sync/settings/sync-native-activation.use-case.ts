import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";
import type { SyncSettingsResult } from "./sync-settings.js";
import type { SyncSettings } from "./sync-settings.use-case.js";

export interface SyncNativeActivationRequest {
  readonly projectRoot: string;
  /** Narrows activation to these marketplaces alone; omitted, every registered one is
   * re-driven. */
  readonly marketplaceNames?: readonly string[];
  /** Brings only the plugins a host's own server holds up to the framework's build, on the
   * machine, for these tools: every other tool is left to the command that changed its plugins. */
  readonly served?: readonly AiToolId[] | "all";
}

const NOTHING_SERVED: SyncSettingsResult = {
  activated: [],
  binaryMissing: [],
  warnings: [],
  errors: [],
  failed: false,
};

/** Re-drives native activation after a command changed what is registered. The shared
 * marketplace is never recreated here: only `sync` itself repopulates an empty registry. The
 * outcome is handed back whole, `failed` included, so the command only prints it. */
export class SyncNativeActivation {
  constructor(
    private readonly syncSettings: Pick<SyncSettings, "execute">,
    private readonly servedTools: readonly ToolId[] = []
  ) {}

  execute(request: SyncNativeActivationRequest): Promise<SyncSettingsResult> {
    if (request.served !== undefined) return this.syncServed(request.projectRoot, request.served);
    return this.syncSettings.execute({
      projectRoot: request.projectRoot,
      marketplaceNames: request.marketplaceNames,
    });
  }

  private async syncServed(
    projectRoot: string,
    asked: readonly AiToolId[] | "all"
  ): Promise<SyncSettingsResult> {
    const toolIds = this.servedTools.filter((id) => asked === "all" || asked.some((t) => t === id));
    if (toolIds.length === 0) return NOTHING_SERVED;
    return this.syncSettings.execute({ projectRoot, scope: "user", toolIds });
  }
}
