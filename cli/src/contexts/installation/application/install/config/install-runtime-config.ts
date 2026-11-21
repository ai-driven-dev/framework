import { join } from "node:path";
import { FileHash } from "../../../../../shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../shared/domain/installation-file.js";
import { isErrnoException } from "../../../../../shared/domain/reading/json-file.js";
import type { AiToolId } from "../../../../../shared/domain/tool.js";
import type { AssetProvider } from "../../../../../shared/ports/asset-provider.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { ToolCatalog } from "../../../../tools/contract/tool-catalog.js";
import type {
  McpConfigAnswers,
  SettingsFileAnswers,
} from "../../../../tools/contract/tool-profile.js";
import type { Manifest } from "../../../domain/manifest.js";
import type { RuntimeConfigSection } from "../../../ports/tool-sections.js";
import type { RunPostInstallPipeline } from "../run-post-install-pipeline.js";
import type { BeforeWriteGate, TrackedConfigFiles } from "./tracked-config-files.js";

export interface InstallRuntimeConfigCommand {
  toolId: AiToolId;
  projectRoot: string;
  manifest: Manifest;
  force: boolean;
  version: string;
  /** Optional per-file gate for the update path. Returns "skip" to leave the file unwritten. Defaults to always-write. */
  onBeforeWriteRegularFile?: BeforeWriteGate;
}

export interface InstallRuntimeConfigResult {
  toolId: AiToolId;
  fileCount: number;
  files: InstallationFile[];
  skipped: boolean;
  warnings: string[];
}

/** What InstallRuntimeConfig is built from. */
export interface InstallRuntimeConfigDeps {
  readonly trackedConfigFiles: TrackedConfigFiles;
  readonly fs: FileReader & FileWriter;
  readonly assets: AssetProvider;
  readonly runPostInstallPipeline: RunPostInstallPipeline;
}

export class InstallRuntimeConfig {
  constructor(
    private readonly deps: InstallRuntimeConfigDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(options: InstallRuntimeConfigCommand): Promise<InstallRuntimeConfigResult> {
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
    profile: RuntimeConfigSection,
    projectRoot: string,
    manifest: Manifest
  ): Promise<void> {
    const toolId = profile.toolId;
    for (const [fileName, relativePath] of Object.entries(profile.runtimeFiles())) {
      const path = join(projectRoot, relativePath);
      if (await this.deps.fs.fileExists(path)) continue;
      const asset = this.deps.assets.loadConfigAsset(toolId, fileName);
      const content = typeof asset === "string" ? asset : JSON.stringify(asset, null, 2);
      await this.deps.fs.writeFile(path, content);
      manifest.recordFileHash(toolId, relativePath, FileHash.of(content));
    }
  }

  private async applyAndTrack(
    regularFiles: InstallationFile[],
    mergeFiles: InstallationFile[],
    options: InstallRuntimeConfigCommand
  ): Promise<void> {
    const allTracked = await this.deps.trackedConfigFiles.execute({
      kind: "write-and-track",
      files: regularFiles,
      projectRoot: options.projectRoot,
      onBeforeWrite: options.onBeforeWriteRegularFile,
    });
    const mergeEntries = await this.deps.trackedConfigFiles.execute({
      kind: "merge-and-track",
      files: mergeFiles,
      projectRoot: options.projectRoot,
    });
    options.manifest.addTool(options.toolId, options.version, allTracked);
    options.manifest.updateToolMergeFiles(options.toolId, mergeEntries);
    await this.deps.runPostInstallPipeline.execute({
      projectRoot: options.projectRoot,
      manifest: options.manifest,
    });
  }

  private async buildConfigFiles(
    options: InstallRuntimeConfigCommand
  ): Promise<InstallationFile[]> {
    const profile = this.tools.aiProfile(options.toolId);
    const files: InstallationFile[] = [];
    for (const [fileName, outputPath] of Object.entries(profile.configFiles())) {
      const resolvedPath = await this.resolveConfigPath({
        mcp: profile.mcpConfig(),
        fileName,
        outputPath,
        projectRoot: options.projectRoot,
      });
      const asset = this.deps.assets.loadConfigAsset(options.toolId, fileName);
      let content = typeof asset === "string" ? asset : JSON.stringify(asset, null, 2);
      const userOwned = await this.deps.trackedConfigFiles.execute({
        kind: "is-user-owned",
        relativePath: resolvedPath,
        projectRoot: options.projectRoot,
        manifest: options.manifest,
      });
      if (userOwned) continue;
      const mcp = profile.mcpConfig();
      if (mcp?.isFrameworkPrimeJson(fileName)) {
        content = mcp.frameworkConfigOver(
          content,
          await this.readExistingConfig(resolvedPath, options.projectRoot),
          {}
        );
      }
      files.push(InstallationFile.hashing(resolvedPath, content));
    }
    return files;
  }

  private async resolveConfigPath(config: {
    mcp: McpConfigAnswers | null;
    fileName: string;
    outputPath: string;
    projectRoot: string;
  }): Promise<string> {
    const { mcp, fileName, outputPath, projectRoot } = config;
    if (mcp === null || !mcp.accepts(fileName)) return outputPath;
    return mcp.resolveOutputPath((relativePath) =>
      this.deps.fs.fileExists(join(projectRoot, relativePath))
    );
  }

  private async readExistingConfig(
    relativePath: string,
    projectRoot: string
  ): Promise<string | null> {
    try {
      return await this.deps.fs.readFile(join(projectRoot, relativePath));
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") return null;
      throw error;
    }
  }

  private buildStaticSettingsFiles(options: InstallRuntimeConfigCommand): InstallationFile[] {
    const result: InstallationFile[] = [];
    for (const cap of this.tools.aiProfile(options.toolId).settingsFiles()) {
      const file = this.buildStaticSettingsFile(cap, options);
      if (file !== null) result.push(file);
    }
    return result;
  }

  private buildStaticSettingsFile(
    cap: SettingsFileAnswers,
    options: InstallRuntimeConfigCommand
  ): InstallationFile | null {
    if (!cap.appliesWith((toolId) => options.manifest.hasTool(toolId))) return null;
    const content = cap.resolveStaticContent((fileName) =>
      this.deps.assets.loadConfigAsset(options.toolId, fileName)
    );
    if (content === null) return null;
    return cap.fileOf(content);
  }
}
