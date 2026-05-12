import { join } from "node:path";
import { SettingsCapability } from "../../../domain/capabilities/settings-capability.js";
import { InstallationFile } from "../../../domain/models/file.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import { extractMergeEntries, type MergeFileEntry } from "../../../domain/models/merge.js";
import type { AiToolId } from "../../../domain/models/tool-ids.js";
import type { AssetProvider } from "../../../domain/ports/asset-provider.js";
import type { FileMerger } from "../../../domain/ports/file-merger.js";
import type { FileReader } from "../../../domain/ports/file-reader.js";
import type { FileWriter } from "../../../domain/ports/file-writer.js";
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
    private readonly fs: FileReader & FileWriter & FileMerger,
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
    const regularFiles = await this.buildConfigFiles(options);
    const mergeFiles = this.buildStaticSettingsFiles(options);
    await this.writeRegularFiles(regularFiles, options.projectRoot);
    await this.writeMergeFiles(mergeFiles, options.projectRoot);
    const mergeEntries = await this.buildMergeEntries(mergeFiles, options.projectRoot);
    const allFiles = [...regularFiles, ...mergeFiles];
    manifest.addTool(toolId, options.version, regularFiles, mergeEntries);
    await new PostInstallPipelineUseCase(this.fs, this.manifestRepo).execute({
      projectRoot: options.projectRoot,
      manifest,
    });
    return {
      toolId,
      fileCount: allFiles.length,
      files: allFiles,
      skipped: false,
      warnings: [],
    };
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

  private buildStaticSettingsFiles(options: InstallRuntimeConfigOptions): InstallationFile[] {
    const toolConfig = getToolConfig(options.toolId);
    if (!isAiTool(toolConfig)) return [];
    const caps = toolConfig.capabilities as Record<string, unknown>;
    const raw = caps.settings;
    const capabilities = Array.isArray(raw) ? raw : raw !== undefined ? [raw] : [];
    const result: InstallationFile[] = [];
    for (const cap of capabilities) {
      const file = this.buildStaticSettingsFile(cap, options);
      if (file !== null) result.push(file);
    }
    return result;
  }

  private buildStaticSettingsFile(
    cap: unknown,
    options: InstallRuntimeConfigOptions
  ): InstallationFile | null {
    if (!(cap instanceof SettingsCapability)) return null;
    const hasStaticForm =
      cap.staticContent !== undefined || cap.staticContentAssetFile !== undefined;
    if (!hasStaticForm) return null;
    if (cap.requiresTool && !options.manifest.hasTool(cap.requiresTool)) return null;
    const content = this.resolveStaticContent(cap, options.toolId);
    return new InstallationFile({
      relativePath: cap.buildOutputPath(),
      content,
      hash: this.hasher.hash(content),
      mergeStrategy: cap.getMergeStrategy(),
    });
  }

  private resolveStaticContent(cap: SettingsCapability, toolId: AiToolId): string {
    if (cap.staticContent !== undefined) return cap.staticContent;
    const asset = this.assets.loadConfigAsset(toolId, cap.staticContentAssetFile as string);
    return typeof asset === "string" ? asset : JSON.stringify(asset, null, 2);
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

  private async writeRegularFiles(files: InstallationFile[], projectRoot: string): Promise<void> {
    for (const file of files) {
      await this.fs.writeFile(join(projectRoot, file.relativePath), file.content);
    }
  }

  private async writeMergeFiles(files: InstallationFile[], projectRoot: string): Promise<void> {
    for (const file of files) {
      await this.fs.mergeJsonFile(
        join(projectRoot, file.relativePath),
        file.content,
        file.mergeStrategy
      );
    }
  }

  private async buildMergeEntries(
    files: InstallationFile[],
    projectRoot: string
  ): Promise<MergeFileEntry[]> {
    const entries: MergeFileEntry[] = [];
    for (const file of files) {
      const fullPath = join(projectRoot, file.relativePath);
      const diskContent = await this.fs.readFile(fullPath);
      const hashes = extractMergeEntries(diskContent, null, this.hasher);
      entries.push({ relativePath: file.relativePath, sectionKey: null, entries: hashes });
    }
    return entries;
  }
}
