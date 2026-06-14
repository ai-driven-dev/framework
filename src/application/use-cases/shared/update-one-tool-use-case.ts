import type { Manifest } from "../../../domain/models/manifest.js";
import type { AiToolId, IdeToolId } from "../../../domain/models/tool-ids.js";
import { getToolConfig, isAiTool, type ToolId } from "../../../domain/tools/registry.js";
import type { InstallIdeConfigUseCase } from "../install/install-ide-config-use-case.js";
import type { InstallRuntimeConfigUseCase } from "../install/install-runtime-config-use-case.js";

export interface GlobalExecutionError {
  scope: string;
  message: string;
}

export class UpdateOneToolUseCase {
  constructor(
    private readonly installRuntimeConfigUseCase: InstallRuntimeConfigUseCase,
    private readonly installIdeConfigUseCase: InstallIdeConfigUseCase
  ) {}

  async execute(
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
}
