import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import {
  assertToolSupportsScope,
  getToolSupportedScope,
  type InstallScope,
} from "../../domain/install-scope.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";

export interface PlanPluginInstallCommand {
  readonly toolIds: AiToolId[] | "all";
  readonly scope: InstallScope;
  readonly tools: ToolCatalog;
}

/** Refuses a plugin install whose scope a targeted tool cannot honour, before anything is fetched. */
export class PlanPluginInstall {
  constructor(private readonly manifestRepo: ManifestRepository) {}

  async execute(command: PlanPluginInstallCommand): Promise<void> {
    const { tools, scope } = command;
    for (const toolId of await this.targets(command.toolIds, tools)) {
      const requiresUserScope = tools.aiProfile(toolId).plugins()?.requiresUserScope() === true;
      assertToolSupportsScope(toolId, scope, getToolSupportedScope(requiresUserScope));
    }
  }

  private async targets(
    toolIds: AiToolId[] | "all",
    tools: ToolCatalog
  ): Promise<readonly AiToolId[]> {
    if (toolIds !== "all") return toolIds;
    const manifest = await this.manifestRepo.load();
    if (manifest === null) return tools.idsInCanonicalOrder("ai");
    const installed = manifest.getInstalledToolIds();
    return tools.idsInCanonicalOrder("ai").filter((id) => installed.includes(id));
  }
}
