import { join } from "node:path";
import { FileHash } from "../../../../../shared/domain/file-hash.js";
import type { InstallationFile } from "../../../../../shared/domain/installation-file.js";
import type { AiToolId } from "../../../../../shared/domain/tool.js";
import type { AssetProvider } from "../../../../../shared/ports/asset-provider.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { ToolCatalog } from "../../../../tools/contract/tool-catalog.js";
import type { SettingsFileAnswers } from "../../../../tools/contract/tool-profile.js";
import type { Manifest } from "../../../domain/manifest.js";
import type { RuntimeConfigSection } from "../../../ports/tool-sections.js";
import type { RunPostInstallPipeline } from "../run-post-install-pipeline.js";
import { buildConfigFiles } from "./build-config-files.js";
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
    const regularFiles = await buildConfigFiles(this.deps, this.tools, options);
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
