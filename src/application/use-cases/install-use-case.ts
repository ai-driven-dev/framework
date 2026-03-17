import { join } from "node:path";
import { generateDistribution } from "../../domain/models/distribution.js";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import type { Manifest } from "../../domain/models/manifest.js";
import { getToolConfig, type ToolId, VALID_TOOL_IDS } from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import { CatalogUseCase } from "./catalog-use-case.js";

interface InstallOptions {
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
  warnings: string[];
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

    if (toolIds.length === 0) {
      throw new Error(
        `At least one tool ID is required. Valid tools: ${VALID_TOOL_IDS.join(", ")}`
      );
    }

    const manifest = await this.manifestRepo.load();
    if (manifest === null) {
      throw new Error("No AIDD installation found. Run `aidd init` first.");
    }

    const { descriptor, contentFiles } = await this.loader.loadFromDirectory(
      frameworkPath,
      version
    );

    const results: InstallToolResult[] = [];

    for (const toolId of toolIds) {
      if (manifest.hasTool(toolId) && !force) {
        results.push({ toolId, fileCount: 0, files: [], skipped: true, warnings: [] });
        continue;
      }

      const config = getToolConfig(toolId);
      const warnings: string[] = [];

      if (!manifest.hasTool(toolId) && force) {
        const toolDir = join(projectRoot, config.directory);
        if (await this.fs.fileExists(toolDir)) {
          warnings.push(
            `Directory ${config.directory} exists but tool is not in manifest. Files will be overwritten.`
          );
        }
      }

      this.logger.info(`Generating ${toolId} distribution...`);

      const generated = generateDistribution(
        descriptor,
        config,
        docsDir,
        contentFiles,
        this.hasher
      );

      if (manifest.hasTool(toolId)) {
        const newPaths = new Set(generated.map((f) => f.relativePath));
        for (const oldFile of manifest.getToolFiles(toolId)) {
          if (!newPaths.has(oldFile.relativePath)) {
            await this.fs.deleteFile(join(projectRoot, oldFile.relativePath));
          }
        }
      }

      const finalFiles = await this.writeToolFiles(generated, projectRoot, manifest);
      manifest.addTool(toolId, descriptor.version, finalFiles);

      results.push({
        toolId,
        fileCount: generated.length,
        files: generated,
        skipped: false,
        warnings,
      });
    }

    await this.manifestRepo.save(manifest);
    await new CatalogUseCase(this.fs).execute({ manifest, docsDir, projectRoot });

    return results;
  }

  private async writeToolFiles(
    generated: GeneratedFile[],
    projectRoot: string,
    manifest: Manifest
  ): Promise<GeneratedFile[]> {
    const finalFiles: GeneratedFile[] = [];
    for (const file of generated) {
      const outputPath = join(projectRoot, file.relativePath);
      if (file.merge) {
        await this.fs.mergeJsonFile(outputPath, file.content);
        const diskHash = await this.fs.readFileHash(outputPath);
        manifest.syncFileHashAcrossTools(file.relativePath, diskHash);
        finalFiles.push(
          new GeneratedFile({
            relativePath: file.relativePath,
            content: file.content,
            hash: diskHash,
            merge: true,
          })
        );
      } else {
        await this.fs.writeFile(outputPath, file.content);
        finalFiles.push(file);
      }
    }
    return finalFiles;
  }
}
