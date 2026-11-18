import type { IdeToolId } from "../../../../shared/domain/tool.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstallIdeConfig, InstallIdeConfigResult } from "./config/install-ide-config.js";
import type { PropagateAiSettingsToIde } from "./propagate-ai-settings-to-ide.js";

export interface InstallIdeToolCommand {
  toolId: IdeToolId;
  projectRoot: string;
  manifest: Manifest;
  force: boolean;
  version: string;
}

export class InstallIdeTool {
  constructor(
    private readonly installIdeConfig: InstallIdeConfig,
    private readonly propagateAiSettingsToIde: PropagateAiSettingsToIde
  ) {}

  async execute(options: InstallIdeToolCommand): Promise<InstallIdeConfigResult> {
    const result = await this.installIdeConfig.execute(options);
    if (result.skipped) return result;
    await this.propagateAiSettingsToIde.execute({
      ideId: options.toolId,
      projectRoot: options.projectRoot,
    });
    return result;
  }
}
