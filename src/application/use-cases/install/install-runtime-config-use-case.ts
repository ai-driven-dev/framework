import { join } from "node:path";
import { InstallationFile } from "../../../domain/models/file.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import type { AiToolId } from "../../../domain/models/tool-ids.js";
import type { AssetProvider } from "../../../domain/ports/asset-provider.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { Logger } from "../../../domain/ports/logger.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import { getToolConfig, isAiTool } from "../../../domain/tools/registry.js";
import { PostInstallPipelineUseCase } from "../shared/post-install-pipeline-use-case.js";

export interface InstallRuntimeConfigOptions {
  toolId: AiToolId;
  projectRoot: string;
  manifest: Manifest;
  force: boolean;
  version: string;
}

export interface InstallRuntimeConfigResult {
  toolId: AiToolId;
  fileCount: number;
  files: InstallationFile[];
  skipped: boolean;
  warnings: string[];
}

export class InstallRuntimeConfigUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly assets: AssetProvider
  ) {}

  async execute(options: InstallRuntimeConfigOptions): Promise<InstallRuntimeConfigResult> {
    const { toolId, manifest, force } = options;
    if (manifest.hasTool(toolId) && !force) {
      return { toolId, fileCount: 0, files: [], skipped: true, warnings: [] };
    }
    const allFiles = await this.buildConfigFiles(options);
    await this.writeFiles(allFiles, options.projectRoot);
    manifest.addTool(toolId, options.version, allFiles);
    await new PostInstallPipelineUseCase(this.fs, this.manifestRepo).execute({
      projectRoot: options.projectRoot,
      manifest,
      docsDir: manifest.docsDir,
    });
    return { toolId, fileCount: allFiles.length, files: allFiles, skipped: false, warnings: [] };
  }

  private async buildConfigFiles(
    options: InstallRuntimeConfigOptions
  ): Promise<InstallationFile[]> {
    const toolConfig = getToolConfig(options.toolId);
    if (!isAiTool(toolConfig) || !toolConfig.configOutputPaths) return [];
    const files: InstallationFile[] = [];
    for (const [fileName, outputPath] of Object.entries(toolConfig.configOutputPaths)) {
      const asset = this.assets.loadConfigAsset(options.toolId, fileName);
      const content = typeof asset === "string" ? asset : JSON.stringify(asset, null, 2);
      if (await this.isUserOwned(outputPath, options)) continue;
      files.push(
        new InstallationFile({ relativePath: outputPath, content, hash: this.hasher.hash(content) })
      );
    }
    return files;
  }

  private async isUserOwned(
    relativePath: string,
    options: InstallRuntimeConfigOptions
  ): Promise<boolean> {
    const fullPath = join(options.projectRoot, relativePath);
    if (!(await this.fs.fileExists(fullPath))) return false;
    if (options.manifest.isFileTracked(relativePath)) return false;
    this.logger.warn(`Skipping ${relativePath} — exists but not tracked by aidd`);
    return true;
  }

  private async writeFiles(files: InstallationFile[], projectRoot: string): Promise<void> {
    for (const file of files) {
      await this.fs.writeFile(join(projectRoot, file.relativePath), file.content);
    }
  }
}
