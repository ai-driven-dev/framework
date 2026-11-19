import type { Scope } from "../../../../shared/domain/scope.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { assertToolSupportsScope, getToolSupportedScope } from "../../domain/install-scope.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";

export interface PlanPluginInstallCommand {
  readonly toolIds: AiToolId[] | "all";
  readonly scope: Scope;
}

/** Refuses a plugin install whose scope a targeted tool cannot honour, before anything is fetched. */
export class PlanPluginInstall {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly tools: ToolCatalog
  ) {}

  async execute(command: PlanPluginInstallCommand): Promise<void> {
    const { scope } = command;
    for (const toolId of await this.targets(command.toolIds)) {
      const requiresUserScope =
        this.tools.aiProfile(toolId).plugins()?.requiresUserScope() === true;
      assertToolSupportsScope(toolId, scope, getToolSupportedScope(requiresUserScope));
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
