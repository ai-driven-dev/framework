import { dirname, join } from "node:path";
import type { Manifest } from "../../../domain/models/manifest.js";
import type { IdeToolId } from "../../../domain/models/tool-ids.js";
import type { FileReader } from "../../../domain/ports/file-reader.js";
import type { FileWriter } from "../../../domain/ports/file-writer.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import { NoManifestError, ToolNotInstalledError } from "../../errors.js";

export interface UninstallIdeOptions {
  toolId: IdeToolId;
  projectRoot: string;
}

export interface UninstallIdeResult {
  toolId: IdeToolId;
  fileCount: number;
  deletedFiles: string[];
}

export class UninstallIdeUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly manifestRepo: ManifestRepository
  ) {}

  async execute(options: UninstallIdeOptions): Promise<UninstallIdeResult> {
    const { toolId, projectRoot } = options;
    const manifest = await this.manifestRepo.load();
    if (manifest === null) throw new NoManifestError();
    if (!manifest.hasTool(toolId)) throw new ToolNotInstalledError(toolId);
    const deletedFiles = await this.deleteTrackedFiles(toolId, manifest, projectRoot);
    manifest.removeTool(toolId);
    await this.manifestRepo.save(manifest);
    return { toolId, fileCount: deletedFiles.length, deletedFiles };
  }

  private async deleteTrackedFiles(
    toolId: IdeToolId,
    manifest: Manifest,
    projectRoot: string
  ): Promise<string[]> {
    const deleted: string[] = [];
    for (const { relativePath } of manifest.getToolFiles(toolId)) {
      const fullPath = join(projectRoot, relativePath);
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
      deleted.push(relativePath);
    }
    return deleted;
  }
}
