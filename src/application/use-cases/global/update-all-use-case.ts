import { Manifest } from "../../../domain/models/manifest.js";
import type { AiToolId, IdeToolId } from "../../../domain/models/tool-ids.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import type { VersionReader } from "../../../domain/ports/version-reader.js";
import { getToolConfig, isAiTool, type ToolId } from "../../../domain/tools/registry.js";
import type { InstallIdeConfigUseCase } from "../install/install-ide-config-use-case.js";
import type { InstallRuntimeConfigUseCase } from "../install/install-runtime-config-use-case.js";
import type { MarketplaceRefreshUseCase } from "../marketplace/marketplace-refresh-use-case.js";
import type { PluginUpdateUseCase } from "../plugin/plugin-update-use-case.js";

export interface GlobalExecutionError {
  scope: string;
  message: string;
}

export interface UpdateAllResult {
  updatedTools: { toolId: ToolId; fileCount: number }[];
  updatedPlugins: string[];
  marketplaceRefreshFailed: boolean;
  errors: GlobalExecutionError[];
}

export class UpdateAllUseCase {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly versionReader: VersionReader,
    private readonly installRuntimeConfigUseCase: InstallRuntimeConfigUseCase,
    private readonly installIdeConfigUseCase: InstallIdeConfigUseCase,
    private readonly pluginUpdateUseCase: PluginUpdateUseCase,
    private readonly marketplaceRefreshUseCase: MarketplaceRefreshUseCase
  ) {}

  async execute(projectRoot: string): Promise<UpdateAllResult> {
    const manifest = (await this.manifestRepo.load()) ?? Manifest.create();
    const version = this.versionReader.get();
    const errors: GlobalExecutionError[] = [];
    const updatedTools = await this.updateTools(manifest, projectRoot, version, errors);
    const updatedPlugins = await this.updatePlugins(projectRoot, errors);
    const marketplaceRefreshFailed = await this.refreshMarketplaces(projectRoot, errors);
    return { updatedTools, updatedPlugins, marketplaceRefreshFailed, errors };
  }

  private async updateTools(
    manifest: Manifest,
    projectRoot: string,
    version: string,
    errors: GlobalExecutionError[]
  ): Promise<{ toolId: ToolId; fileCount: number }[]> {
    const updated: { toolId: ToolId; fileCount: number }[] = [];
    for (const toolId of manifest.getInstalledToolIds()) {
      const entry = await this.updateOneTool(toolId, manifest, projectRoot, version, errors);
      if (entry) updated.push(entry);
    }
    return updated;
  }

  private async updateOneTool(
    toolId: ToolId,
    manifest: Manifest,
    projectRoot: string,
    version: string,
    errors: GlobalExecutionError[]
  ): Promise<{ toolId: ToolId; fileCount: number } | null> {
    try {
      const config = getToolConfig(toolId);
      const result = isAiTool(config)
        ? await this.installRuntimeConfigUseCase.execute({
            toolId: toolId as AiToolId,
            projectRoot,
            manifest,
            force: true,
            version,
          })
        : await this.installIdeConfigUseCase.execute({
            toolId: toolId as IdeToolId,
            projectRoot,
            manifest,
            force: true,
            version,
          });
      if (result.skipped) return null;
      return { toolId, fileCount: result.fileCount };
    } catch (err) {
      errors.push({ scope: toolId, message: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }

  private async updatePlugins(
    projectRoot: string,
    errors: GlobalExecutionError[]
  ): Promise<string[]> {
    try {
      return await this.pluginUpdateUseCase.execute({ toolIds: "all", projectRoot });
    } catch (err) {
      errors.push({ scope: "plugins", message: err instanceof Error ? err.message : String(err) });
      return [];
    }
  }

  private async refreshMarketplaces(
    projectRoot: string,
    errors: GlobalExecutionError[]
  ): Promise<boolean> {
    try {
      const { failedCount } = await this.marketplaceRefreshUseCase.execute({ projectRoot });
      return failedCount > 0;
    } catch (err) {
      errors.push({
        scope: "marketplace-refresh",
        message: err instanceof Error ? err.message : String(err),
      });
      return true;
    }
  }
}
