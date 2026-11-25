import type { IdeToolId } from "../../../../shared/domain/tool.js";
import { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type {
  InstallIdeConfig,
  InstallIdeConfigResult,
} from "./config/install-ide-config.use-case.js";
import type { PropagateAiSettingsToIde } from "./propagate-ai-settings-to-ide.use-case.js";

export interface InstallIdeToolRequest {
  toolId: IdeToolId;
  projectRoot: string;
  force: boolean;
  version: string;
}

export class InstallIdeTool {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly installIdeConfig: InstallIdeConfig,
    private readonly propagateAiSettingsToIde: PropagateAiSettingsToIde
  ) {}

  async execute(options: InstallIdeToolRequest): Promise<InstallIdeConfigResult> {
    const manifest = (await this.manifestRepo.load()) ?? Manifest.create();
    const result = await this.installIdeConfig.execute({ ...options, manifest });
    if (result.skipped) return result;
    await this.propagateAiSettingsToIde.execute({
      ideId: options.toolId,
      projectRoot: options.projectRoot,
    });
    return result;
  }
}
