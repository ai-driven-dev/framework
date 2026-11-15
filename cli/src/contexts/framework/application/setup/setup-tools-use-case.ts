import type { AiToolId, IdeToolId } from "../../../../shared/domain/tool.js";
import type {
  InstallIdeConfigCommand,
  InstallIdeConfigResult,
} from "../../../installation/application/install/install-ide-config-use-case.js";
import type {
  InstallRuntimeConfigCommand,
  InstallRuntimeConfigResult,
} from "../../../installation/application/install/install-runtime-config-use-case.js";
import { Manifest } from "../../../installation/domain/manifest.js";
import type { ManifestRepository } from "../../../installation/ports/manifest-repository.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";

export type ToolInstallResult = InstallRuntimeConfigResult | InstallIdeConfigResult;

export interface SetupToolsOptions {
  projectRoot: string;
  aiTools: readonly AiToolId[];
  ideTools: readonly IdeToolId[];
  force: boolean;
  version: string;
  tools: ToolCatalog;
}

export interface SetupToolsResult {
  results: ToolInstallResult[];
}

export class SetupToolsUseCase {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly installRuntimeConfigUseCase: InstallRuntimeConfigCommand,
    private readonly installIdeConfigUseCase: InstallIdeConfigCommand
  ) {}

  async execute(options: SetupToolsOptions): Promise<SetupToolsResult> {
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
    options: SetupToolsOptions
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
    options: SetupToolsOptions
  ): Promise<InstallIdeConfigResult> {
    return this.installIdeConfigUseCase.execute({
      toolId,
      projectRoot: options.projectRoot,
      manifest,
      force: options.force,
      version: options.version,
      tools: options.tools,
    });
  }
}
