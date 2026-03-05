import { join } from "node:path";
import { generateDistribution } from "../../domain/models/distribution.js";
import type { GeneratedFile } from "../../domain/models/generated-file.js";
import { type ToolId, VALID_TOOL_IDS, getToolConfig } from "../../domain/models/tool-config.js";
import "../../domain/tools/claude.js";
import "../../domain/tools/copilot.js";
import "../../domain/tools/cursor.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";

export interface InstallOptions {
  toolIds: ToolId[];
  frameworkPath: string;
  version: string;
  docsDir: string;
  projectRoot: string;
  force?: boolean;
}

export interface InstallToolResult {
  toolId: ToolId;
  fileCount: number;
  files: GeneratedFile[];
  skipped: boolean;
}

export class InstallUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly loader: FrameworkLoader,
    private readonly hasher: Hasher,
    private readonly logger: Logger
  ) {}

  async execute(options: InstallOptions): Promise<InstallToolResult[]> {
    const { toolIds, frameworkPath, version, docsDir, projectRoot, force = false } = options;

    const validTools = VALID_TOOL_IDS.join(", ");

    if (toolIds.length === 0) {
      throw new Error(`At least one tool ID is required. Valid tools: ${validTools}`);
    }

    const unknownTools = toolIds.filter((id) => !VALID_TOOL_IDS.includes(id));
    if (unknownTools.length > 0) {
      throw new Error(`Unknown tool: ${unknownTools.join(", ")}. Valid tools: ${validTools}`);
    }

    const manifest = await this.manifestRepo.load();
    if (manifest === null) {
      throw new Error("No manifest found. Run aidd init first.");
    }

    const { descriptor, contentFiles } = await this.loader.loadFromDirectory(
      frameworkPath,
      version
    );

    const results: InstallToolResult[] = [];

    for (const toolId of toolIds) {
      if (manifest.hasTool(toolId) && !force) {
        results.push({ toolId, fileCount: 0, files: [], skipped: true });
        continue;
      }

      const config = getToolConfig(toolId);

      this.logger.info(`Generating ${toolId} distribution...`);

      const generated = generateDistribution(
        descriptor,
        config,
        docsDir,
        contentFiles,
        this.hasher
      );

      for (const file of generated) {
        const outputPath = join(projectRoot, file.relativePath);
        await this.fs.writeFile(outputPath, file.content);
      }

      manifest.addTool(toolId, descriptor.version, generated);

      results.push({
        toolId,
        fileCount: generated.length,
        files: generated,
        skipped: false,
      });
    }

    await this.manifestRepo.save(manifest);

    return results;
  }
}
