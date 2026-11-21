import { basename } from "node:path";
import { InstallationFile } from "../../../../../shared/domain/installation-file.js";
import type { IdeToolId } from "../../../../../shared/domain/tool.js";
import type { AssetProvider } from "../../../../../shared/ports/asset-provider.js";
import type { ToolCatalog } from "../../../../tools/contract/tool-catalog.js";
import type { SettingsFileAnswers } from "../../../../tools/contract/tool-profile.js";
import type { Manifest } from "../../../domain/manifest.js";
import type { RunPostInstallPipeline } from "../run-post-install-pipeline.js";
import type { BeforeWriteGate, TrackedConfigFiles } from "./tracked-config-files.js";

export interface InstallIdeConfigCommand {
  toolId: IdeToolId;
  projectRoot: string;
  manifest: Manifest;
  force: boolean;
  version: string;
  /** Optional per-file gate for the update path. Returns "skip" to leave the file unwritten. Defaults to always-write. */
  onBeforeWriteRegularFile?: BeforeWriteGate;
}

export interface InstallIdeConfigResult {
  toolId: IdeToolId;
  fileCount: number;
  files: InstallationFile[];
  skipped: boolean;
  warnings: string[];
}

export class InstallIdeConfig {
  constructor(
    private readonly trackedConfigFiles: TrackedConfigFiles,
    private readonly assets: AssetProvider,
    private readonly runPostInstallPipeline: RunPostInstallPipeline,
    /** The profiles the install answers from: the tool's own and every installed one. */
    private readonly tools: ToolCatalog
  ) {}

  async execute(options: InstallIdeConfigCommand): Promise<InstallIdeConfigResult> {
    const { toolId, manifest, force } = options;
    if (manifest.hasTool(toolId) && !force) {
      return { toolId, fileCount: 0, files: [], skipped: true, warnings: [] };
    }
    const { regularFiles, mergeFiles } = await this.buildSettingsFiles(options);
    const allTracked = await this.trackedConfigFiles.execute({
      kind: "write-and-track",
      files: regularFiles,
      projectRoot: options.projectRoot,
      onBeforeWrite: options.onBeforeWriteRegularFile,
    });
    const mergeEntries = await this.trackedConfigFiles.execute({
      kind: "merge-and-track",
      files: mergeFiles,
      projectRoot: options.projectRoot,
    });
    const allFiles = [...regularFiles, ...mergeFiles];
    manifest.addTool(toolId, options.version, allTracked);
    manifest.updateToolMergeFiles(toolId, mergeEntries);
    await this.runPostInstallPipeline.execute({
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

  private async buildSettingsFiles(
    options: InstallIdeConfigCommand
  ): Promise<{ regularFiles: InstallationFile[]; mergeFiles: InstallationFile[] }> {
    const capabilities = this.tools.ideProfile(options.toolId).settingsFiles();
    const regularFiles: InstallationFile[] = [];
    const mergeFiles: InstallationFile[] = [];
    for (const capability of capabilities) {
      const file = await this.buildSettingsFile(capability, options);
      if (file === null) continue;
      if (file.mergeStrategy !== "none") mergeFiles.push(file);
      else regularFiles.push(file);
    }
    return { regularFiles, mergeFiles };
  }

  private async buildSettingsFile(
    capability: SettingsFileAnswers,
    options: InstallIdeConfigCommand
  ): Promise<InstallationFile | null> {
    const outputPath = capability.outputPath();
    const userOwned = await this.trackedConfigFiles.execute({
      kind: "is-user-owned",
      relativePath: outputPath,
      projectRoot: options.projectRoot,
      manifest: options.manifest,
    });
    if (userOwned) return null;
    const fileName = basename(outputPath);
    const asset = this.assets.loadConfigAsset(options.toolId, fileName);
    const content = typeof asset === "string" ? asset : JSON.stringify(asset, null, 2);
    return InstallationFile.hashing(outputPath, content, capability.mergeStrategy());
  }
}
