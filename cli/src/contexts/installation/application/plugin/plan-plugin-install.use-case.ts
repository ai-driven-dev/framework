import type { Scope } from "../../../../shared/domain/scope.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { InvalidPluginScopeError } from "../../domain/installation.error.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";

export interface PlanPluginInstallRequest {
  readonly toolIds: AiToolId[] | "all";
  readonly scope: Scope;
}

/** The one scope a tool's plugins install under, as the caller reads it from the tool. */
export type SupportedScope = (toolId: AiToolId) => Scope;

/** Refuses a plugin install whose scope a targeted tool cannot honour, before anything is fetched. */
export class PlanPluginInstall {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly tools: ToolCatalog,
    private readonly supportedScope: SupportedScope
  ) {}

  async execute(command: PlanPluginInstallRequest): Promise<void> {
    const { scope } = command;
    for (const toolId of await this.targets(command.toolIds)) {
      const supported = this.supportedScope(toolId);
      if (supported !== scope) throw new InvalidPluginScopeError(toolId, scope, supported);
    }
  }

  private async targets(toolIds: AiToolId[] | "all"): Promise<readonly AiToolId[]> {
    if (toolIds !== "all") return toolIds;
    const manifest = await this.manifestRepo.load();
    if (manifest === null) return this.tools.idsInCanonicalOrder("ai");
    const installed = manifest.getInstalledToolIds();
    return this.tools.idsInCanonicalOrder("ai").filter((id) => installed.includes(id));
  }
}
