import type { AiToolId, IdeToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { InstallIdeConfig, InstallIdeConfigResult } from "./config/install-ide-config.js";
import type {
  InstallRuntimeConfig,
  InstallRuntimeConfigResult,
} from "./config/install-runtime-config.js";

export type ToolInstallResult = InstallRuntimeConfigResult | InstallIdeConfigResult;

export interface InstallToolsOptions {
  projectRoot: string;
  aiTools: readonly AiToolId[];
  ideTools: readonly IdeToolId[];
  force: boolean;
  version: string;
  tools: ToolCatalog;
}

export interface InstallToolsResult {
  results: ToolInstallResult[];
}

export class InstallTools {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly installRuntimeConfigUseCase: InstallRuntimeConfig,
    private readonly installIdeConfig: InstallIdeConfig
  ) {}

  async execute(options: InstallToolsOptions): Promise<InstallToolsResult> {
    if (options.aiTools.length === 0 && options.ideTools.length === 0) {
      return { results: [] };
    }
    const manifest = (await this.manifestRepo.load()) ?? Manifest.create();
    const results: ToolInstallResult[] = [];
    for (const toolId of options.ideTools) {
      results.push(await this.installIdeTool(toolId, manifest, options));
    }
    for (const toolId of options.aiTools) {
      results.push(await this.installAiTool(toolId, manifest, options));
    }
    return { results };
  }

  private async installAiTool(
    toolId: AiToolId,
    manifest: Manifest,
    options: InstallToolsOptions
  ): Promise<InstallRuntimeConfigResult> {
    return this.installRuntimeConfigUseCase.execute({
      toolId,
      projectRoot: options.projectRoot,
      manifest,
      force: options.force,
      version: options.version,
      tools: options.tools,
    });
  }

  private async installIdeTool(
    toolId: IdeToolId,
    manifest: Manifest,
    options: InstallToolsOptions
  ): Promise<InstallIdeConfigResult> {
    return this.installIdeConfig.execute({
      toolId,
      projectRoot: options.projectRoot,
      manifest,
      force: options.force,
      version: options.version,
      tools: options.tools,
    });
  }
}
