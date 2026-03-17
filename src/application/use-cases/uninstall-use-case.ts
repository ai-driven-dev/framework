import { dirname, join } from "node:path";
import { type ToolId, VALID_TOOL_IDS } from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import { NoManifestError } from "../errors.js";
import { CatalogUseCase } from "./catalog-use-case.js";

interface UninstallOptions {
  toolIds: ToolId[];
  projectRoot: string;
  repo?: string;
}

interface UninstallToolResult {
  toolId: ToolId;
  fileCount: number;
  deletedFiles: string[];
}

export class UninstallUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly logger: Logger
  ) {}

  async execute(options: UninstallOptions): Promise<UninstallToolResult[]> {
    const { toolIds, projectRoot, repo } = options;

    if (toolIds.length === 0) {
      throw new Error(
        `At least one tool ID is required. Valid tools: ${VALID_TOOL_IDS.join(", ")}`
      );
    }

    const manifest = await this.manifestRepo.load();
    if (manifest === null) {
      throw new NoManifestError(repo);
    }

    const results: UninstallToolResult[] = [];

    for (const toolId of toolIds) {
      if (!manifest.hasTool(toolId)) {
        throw new Error(`${toolId} is not installed`);
      }
    }

    for (const toolId of toolIds) {
      this.logger.info(`Removing ${toolId} files...`);

      const remainingToolIds = manifest
        .getInstalledToolIds()
        .filter((id) => id !== toolId && !toolIds.includes(id));
      const sharedPaths = new Set(
        remainingToolIds.flatMap((id) => manifest.getToolFiles(id).map((f) => f.relativePath))
      );

      const files = manifest.getToolFiles(toolId);
      const deletedFiles: string[] = [];

      for (const file of files) {
        if (sharedPaths.has(file.relativePath)) continue;
        const fullPath = join(projectRoot, file.relativePath);
        await this.fs.deleteFile(fullPath);
        deletedFiles.push(file.relativePath);
        await this.fs.deleteEmptyDirectories(dirname(fullPath));
      }

      manifest.removeTool(toolId);
      results.push({ toolId, fileCount: deletedFiles.length, deletedFiles });
    }

    await this.manifestRepo.save(manifest);
    await new CatalogUseCase(this.fs).execute({ manifest, docsDir: manifest.docsDir, projectRoot });
    return results;
  }
}
