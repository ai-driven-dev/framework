import { join } from "node:path";
import { generateDistribution } from "../../domain/models/distribution.js";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import type { Manifest } from "../../domain/models/manifest.js";
import { getToolConfig, type ToolId, VALID_TOOL_IDS } from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";
import type { Git } from "../../domain/ports/git.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { Platform } from "../../domain/ports/platform.js";
import { NoManifestError } from "../errors.js";
import { CatalogUseCase } from "./catalog-use-case.js";
import { MemoryScriptUseCase } from "./memory-script-use-case.js";

interface InstallOptions {
  toolIds: ToolId[];
  frameworkPath: string;
  version: string;
  docsDir: string;
  projectRoot: string;
  force?: boolean;
  repo?: string;
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
    private readonly logger: Logger,
    private readonly git: Git,
    private readonly platform: Platform
  ) {}

  async execute(options: InstallOptions): Promise<InstallToolResult[]> {
    const { toolIds, frameworkPath, version, docsDir, projectRoot, force = false, repo } = options;

    if (toolIds.length === 0) {
      throw new Error(
        `At least one tool ID is required. Valid tools: ${VALID_TOOL_IDS.join(", ")}`
      );
    }

    const manifest = await this.manifestRepo.load();
    if (manifest === null) {
      throw new NoManifestError(repo);
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
        this.hasher,
        this.platform
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

    await new MemoryScriptUseCase(this.fs, this.hasher, this.git).execute({
      projectRoot,
      version,
      descriptor,
      contentFiles,
      manifest,
    });

    await this.manifestRepo.save(manifest);
    await new CatalogUseCase(this.fs).execute({ manifest, docsDir, projectRoot });

    return results;
  }

  private async writeToolFiles(
    generated: GeneratedFile[],
    projectRoot: string,
    manifest: Manifest
  ): Promise<GeneratedFile[]> {
    const filesByPath = new Map<string, GeneratedFile>();
    for (const file of generated) {
      const outputPath = join(projectRoot, file.relativePath);
      if (file.merge) {
        await this.fs.mergeJsonFile(outputPath, file.content);
        const diskHash = await this.fs.readFileHash(outputPath);
        manifest.syncFileHashAcrossTools(file.relativePath, diskHash);
        filesByPath.set(
          file.relativePath,
          new GeneratedFile({
            relativePath: file.relativePath,
            content: file.content,
            hash: diskHash,
            merge: true,
          })
        );
      } else {
        await this.fs.writeFile(outputPath, file.content);
        filesByPath.set(file.relativePath, file);
      }
    }
    return [...filesByPath.values()];
  }
}
