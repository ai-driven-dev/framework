import type { ResolveBuiltMarketplaces } from "../../contexts/distribution/application/resolve-built-marketplaces.use-case.js";
import type { MarketplaceBuilds } from "../../contexts/distribution/contract/built-marketplaces.js";
import type { RegistrationRecordRules } from "../../contexts/host-registration/contract/registration-record-rules.js";
import type { ListRegisteredPlugins } from "../../contexts/installation/application/doctor/list-registered-plugins.use-case.js";
import type { ScopeRecords } from "../../contexts/installation/contract/records/scope-records.js";
import type { RegisteredPluginsOfTool } from "../../contexts/installation/contract/registered-plugins.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { AiToolId } from "../../shared/domain/tool.js";

export interface ResolveRegisteredBuildsRequest {
  projectRoot: string;
  allowedIds: Set<string> | null;
}

export interface RegisteredBuilds extends MarketplaceBuilds {
  readonly registered: readonly RegisteredPluginsOfTool[];
}

/** What the manifest registers per tool, and the marketplaces built for the AI tools among them. */
export class ResolveRegisteredBuilds {
  constructor(
    private readonly listPlugins: ListRegisteredPlugins,
    private readonly records: Pick<RegistrationRecordRules, "pluginRefsOf" | "refOnHostName"> &
      Pick<ScopeRecords, "loadRecords">,
    private readonly builds: Pick<ResolveBuiltMarketplaces, "execute">,
    private readonly tools: ToolCatalog
  ) {}

  async execute({
    projectRoot,
    allowedIds,
  }: ResolveRegisteredBuildsRequest): Promise<RegisteredBuilds> {
    const { tools: registered } = await this.listPlugins.execute({
      allowedIds,
      records: this.records,
    });
    const toolIds: AiToolId[] = [];
    for (const { toolId } of registered) {
      if (this.tools.isAiTool(toolId)) toolIds.push(toolId);
    }
    const built = await this.builds.execute({ projectRoot, toolIds });
    return { ...built, registered };
  }
}
