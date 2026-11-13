import { NoManifestError, ToolNotInstalledError } from "../../../../shared/domain/errors.js";
import type { IdeToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { UninstallToolsUseCase } from "./uninstall-tools-use-case.js";

export interface UninstallIdeOptions {
  toolId: IdeToolId;
  projectRoot: string;
  tools: ToolCatalog;
}

export interface UninstallIdeResult {
  toolId: IdeToolId;
  fileCount: number;
  deletedFiles: string[];
}

export class UninstallIdeUseCase {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly uninstallTools: UninstallToolsUseCase
  ) {}

  async execute(options: UninstallIdeOptions): Promise<UninstallIdeResult> {
    const { toolId, projectRoot, tools } = options;
    const manifest = await this.manifestRepo.load();
    if (manifest === null) throw new NoManifestError();
    if (!manifest.hasTool(toolId)) throw new ToolNotInstalledError(toolId);
    const [result] = await this.uninstallTools.execute({
      toolIds: [toolId],
      manifest,
      projectRoot,
      tools,
    });
    await this.manifestRepo.save(manifest);
    return { toolId, fileCount: result?.fileCount ?? 0, deletedFiles: result?.deletedFiles ?? [] };
  }
}
