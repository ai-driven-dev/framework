import { Manifest } from "../../../domain/models/manifest.js";
import type { AiToolId } from "../../../domain/models/tool-ids.js";
import { isAiToolId } from "../../../domain/models/tool-ids.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import type { VersionReader } from "../../../domain/ports/version-reader.js";
import type { ToolId } from "../../../domain/tools/registry.js";
import type {
  GlobalExecutionError,
  UpdateOneToolUseCase,
} from "../shared/update-one-tool-use-case.js";

export interface UpdateAiToolsInput {
  toolArg?: AiToolId;
  projectRoot: string;
}

export interface UpdateAiToolsResult {
  updatedTools: { toolId: ToolId; fileCount: number }[];
  errors: GlobalExecutionError[];
}

export class UpdateAiToolsUseCase {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly versionReader: VersionReader,
    private readonly updateOneToolUseCase: UpdateOneToolUseCase
  ) {}

  async execute(input: UpdateAiToolsInput): Promise<UpdateAiToolsResult> {
    const { toolArg, projectRoot } = input;
    const manifest = (await this.manifestRepo.load()) ?? Manifest.create();
    const targetIds = this.resolveTargetIds(manifest, toolArg);
    const version = this.versionReader.get();
    const errors: GlobalExecutionError[] = [];
    const updatedTools = await this.updateTargets(
      targetIds,
      manifest,
      projectRoot,
      version,
      errors
    );
    return { updatedTools, errors };
  }

  private resolveTargetIds(manifest: Manifest, toolArg: AiToolId | undefined): AiToolId[] {
    if (toolArg !== undefined) return [toolArg];
    return manifest.getInstalledToolIds().filter(isAiToolId);
  }

  private async updateTargets(
    targetIds: AiToolId[],
    manifest: Manifest,
    projectRoot: string,
    version: string,
    errors: GlobalExecutionError[]
  ): Promise<{ toolId: ToolId; fileCount: number }[]> {
    const updated: { toolId: ToolId; fileCount: number }[] = [];
    for (const toolId of targetIds) {
      const entry = await this.updateOneToolUseCase.execute(
        toolId,
        manifest,
        projectRoot,
        version,
        errors
      );
      if (entry) updated.push(entry);
    }
    return updated;
  }
}
