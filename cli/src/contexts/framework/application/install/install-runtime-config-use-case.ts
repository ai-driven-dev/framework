import { join } from "node:path";
import { InstallationFile } from "../../../../shared/domain/file.js";
import { extractMergeEntries, type MergeFileEntry } from "../../../../shared/domain/merge.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { AssetProvider } from "../../../../shared/ports/asset-provider.js";
import type { FileMerger } from "../../../../shared/ports/file-merger.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Hasher } from "../../../../shared/ports/hasher.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { AiToolProfile, SettingsFileAnswers } from "../../../tools/contract/tool-profile.js";
import type { Manifest } from "../../domain/manifest.js";
import type { PostInstallPipelineUseCase } from "./post-install-pipeline-use-case.js";

export interface InstallRuntimeConfigOptions {
  toolId: AiToolId;
  projectRoot: string;
  manifest: Manifest;
  force: boolean;
  version: string;
  /** The profiles the install answers from: the tool's own and every installed one. */
  tools: ToolCatalog;
  /** Optional per-file gate for the update path. Returns "skip" to leave the file unwritten. Defaults to always-write. */
  onBeforeWriteRegularFile?: (relativePath: string) => Promise<"write" | "skip">;
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
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly assets: AssetProvider,
    private readonly postInstallPipelineUseCase: PostInstallPipelineUseCase
  ) {}

  async execute(options: InstallRuntimeConfigOptions): Promise<InstallRuntimeConfigResult> {
    const { toolId, manifest, force } = options;
    if (manifest.hasTool(toolId) && !force) {
      return { toolId, fileCount: 0, files: [], skipped: true, warnings: [] };
    }
    const regularFiles = await this.buildConfigFiles(options);
    const mergeFiles = this.buildStaticSettingsFiles(options);
    await this.applyAndTrack(regularFiles, mergeFiles, options);
    const allFiles = [...regularFiles, ...mergeFiles];
    return { toolId, fileCount: allFiles.length, files: allFiles, skipped: false, warnings: [] };
  }

  async ensurePluginRuntimeFiles(
    profile: AiToolProfile,
    projectRoot: string,
    manifest: Manifest
  ): Promise<void> {
    const toolId = profile.toolId;
    for (const [fileName, relativePath] of Object.entries(profile.runtimeFiles())) {
      const path = join(projectRoot, relativePath);
      if (await this.fs.fileExists(path)) continue;
      const asset = this.assets.loadConfigAsset(toolId, fileName);
      const content = typeof asset === "string" ? asset : JSON.stringify(asset, null, 2);
      await this.fs.writeFile(path, content);
      manifest.updateTrackedFileHash(toolId, relativePath, this.hasher.hash(content));
    }
  }

  private async applyAndTrack(
    regularFiles: InstallationFile[],
    mergeFiles: InstallationFile[],
    options: InstallRuntimeConfigOptions
  ): Promise<void> {
    const allTracked = await this.writeRegularFiles(
      regularFiles,
      options.projectRoot,
      options.onBeforeWriteRegularFile
    );
    await this.writeMergeFiles(mergeFiles, options.projectRoot);
    const mergeEntries = await this.buildMergeEntries(mergeFiles, options.projectRoot);
    options.manifest.addTool(options.toolId, options.version, allTracked, mergeEntries);
    await this.postInstallPipelineUseCase.execute({
      projectRoot: options.projectRoot,
      manifest: options.manifest,
      tools: options.tools,
    });
  }

  private async buildConfigFiles(
    options: InstallRuntimeConfigOptions
  ): Promise<InstallationFile[]> {
    const profile = options.tools.aiProfile(options.toolId);
    const files: InstallationFile[] = [];
    for (const [fileName, outputPath] of Object.entries(profile.configFiles())) {
      const resolvedPath = await this.resolveConfigPath(profile, fileName, outputPath, options);
      const asset = this.assets.loadConfigAsset(options.toolId, fileName);
      let content = typeof asset === "string" ? asset : JSON.stringify(asset, null, 2);
      if (await this.isUserOwned(resolvedPath, options)) continue;
      const mcp = profile.mcpConfig();
      if (mcp?.isFrameworkPrimeJson(fileName)) {
        content = mcp.frameworkConfigOver(
          content,
          await this.readExistingConfig(resolvedPath, options.projectRoot),
          {}
        );
      }
      files.push(
        new InstallationFile({
          relativePath: resolvedPath,
          content,
          hash: this.hasher.hash(content),
        })
      );
    }
    return files;
  }

  private async resolveConfigPath(
    profile: AiToolProfile,
    fileName: string,
    outputPath: string,
    options: InstallRuntimeConfigOptions
  ): Promise<string> {
    const mcp = profile.mcpConfig();
    if (mcp === null || mcp.outputPath() !== fileName) return outputPath;
    return mcp.resolveOutputPath((relativePath) =>
      this.fs.fileExists(join(options.projectRoot, relativePath))
    );
  }

  private async readExistingConfig(
    relativePath: string,
    projectRoot: string
  ): Promise<string | null> {
    try {
      return await this.fs.readFile(join(projectRoot, relativePath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  private buildStaticSettingsFiles(options: InstallRuntimeConfigOptions): InstallationFile[] {
    const result: InstallationFile[] = [];
    for (const cap of options.tools.aiProfile(options.toolId).settingsFiles()) {
      const file = this.buildStaticSettingsFile(cap, options);
      if (file !== null) result.push(file);
    }
    return result;
  }

  private buildStaticSettingsFile(
    cap: SettingsFileAnswers,
    options: InstallRuntimeConfigOptions
  ): InstallationFile | null {
    const requiredTool = cap.requiredTool();
    if (requiredTool !== null && !options.manifest.hasTool(requiredTool)) return null;
    const content = cap.resolveStaticContent((fileName) =>
      this.assets.loadConfigAsset(options.toolId, fileName)
    );
    if (content === null) return null;
    return new InstallationFile({
      relativePath: cap.outputPath(),
      content,
      hash: this.hasher.hash(content),
      mergeStrategy: cap.mergeStrategy(),
    });
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

  private async writeRegularFiles(
    files: InstallationFile[],
    projectRoot: string,
    onBeforeWrite?: (relativePath: string) => Promise<"write" | "skip">
  ): Promise<InstallationFile[]> {
    const allTracked: InstallationFile[] = [];
    for (const file of files) {
      const decision = onBeforeWrite ? await onBeforeWrite(file.relativePath) : "write";
      if (decision === "skip") {
        const diskFile = await this.buildSkippedFileEntry(file, projectRoot);
        allTracked.push(diskFile);
        continue;
      }
      await this.fs.writeFile(join(projectRoot, file.relativePath), file.content);
      allTracked.push(file);
    }
    return allTracked;
  }

  private async buildSkippedFileEntry(
    file: InstallationFile,
    projectRoot: string
  ): Promise<InstallationFile> {
    const diskPath = join(projectRoot, file.relativePath);
    const diskHash = await this.fs.readFileHash(diskPath);
    return new InstallationFile({ relativePath: file.relativePath, content: "", hash: diskHash });
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
