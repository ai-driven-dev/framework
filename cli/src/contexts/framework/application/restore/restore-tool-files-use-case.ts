import { type FileHash, InstallationFile } from "../../../../shared/domain/file.js";
import type { MergeFileEntry } from "../../../../shared/domain/merge.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { AssetProvider } from "../../../../shared/ports/asset-provider.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Hasher } from "../../../../shared/ports/hasher.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { Prompter } from "../../../../shared/ports/prompter.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { ToolProfile } from "../../../tools/contract/tool-profile.js";
import type { FrameworkDescriptor } from "../../../translate/domain/canon.js";
import type { Manifest } from "../../domain/manifest.js";
import type { FileMerger } from "../../domain/ports/file-merger.js";
import type { Platform } from "../../domain/ports/platform.js";
import { GenerateToolDistributionUseCase } from "./generate-tool-distribution-use-case.js";
import { RestoreMergeFilesUseCase } from "./restore-merge-files-use-case.js";
import { RestoreRegularFilesUseCase } from "./restore-regular-files-use-case.js";

export interface RestoreToolFilesOptions {
  /** Unvalidated text: the restore refuses one no profile declares. */
  toolId: string;
  manifest: Manifest;
  descriptor: FrameworkDescriptor;
  contentFiles: Map<string, string>;
  projectRoot: string;
  version: string;
  force: boolean;
  interactive: boolean;
  fileFilter: ((p: string) => boolean) | null;
  /** The tool profiles the restore asks. */
  tools: ToolCatalog;
}

interface SectionRestoreResult {
  restored: string[];
  kept: string[];
  unrestorable: string[];
  updatedFiles: InstallationFile[];
}

interface MergeSectionRestoreResult {
  restored: string[];
  kept: string[];
  unrestorable: string[];
  updatedMergeFiles: MergeFileEntry[];
}

export interface RestoreToolFilesResult {
  toolId: ToolId;
  nothingToRestore: boolean;
  restored: string[];
  kept: string[];
  unrestorable: string[];
}

export class RestoreToolFilesUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter & FileMerger,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly platform: Platform,
    private readonly prompter: Prompter,
    private readonly assetProvider?: AssetProvider
  ) {}

  async execute(options: RestoreToolFilesOptions): Promise<RestoreToolFilesResult> {
    this.logger.info(`Checking ${options.toolId} for files to restore...`);
    const config = options.tools.profile(options.toolId);
    const { toolId } = config;
    const distMap = await this.buildDistributionMap(options, config);
    const section = await this.restoreSection(options, distMap);
    const mergeSection = await this.restoreMergeSection(options, distMap);
    if (section === null && mergeSection === null) {
      return {
        toolId,
        nothingToRestore: true,
        restored: [],
        kept: [],
        unrestorable: [],
      };
    }
    return this.commitToolRestore(options, toolId, section, mergeSection);
  }

  private async buildDistributionMap(
    options: RestoreToolFilesOptions,
    config: ToolProfile
  ): Promise<Map<string, InstallationFile>> {
    const { descriptor, contentFiles, projectRoot } = options;
    const distribution = await new GenerateToolDistributionUseCase(
      this.fs,
      this.hasher,
      this.platform,
      this.assetProvider
    ).execute({ config, descriptor, contentFiles, projectRoot });
    return new Map(distribution.map((f) => [f.relativePath, f]));
  }

  private async restoreSection(
    options: RestoreToolFilesOptions,
    distMap: Map<string, InstallationFile>
  ): Promise<SectionRestoreResult | null> {
    return new RestoreRegularFilesUseCase(this.fs, this.prompter).execute({
      manifestFiles: options.manifest.getToolFiles(options.toolId),
      distMap,
      projectRoot: options.projectRoot,
      force: options.force,
      interactive: options.interactive,
      fileFilter: options.fileFilter,
    });
  }

  private async restoreMergeSection(
    options: RestoreToolFilesOptions,
    distMap: Map<string, InstallationFile>
  ): Promise<MergeSectionRestoreResult | null> {
    return new RestoreMergeFilesUseCase(this.fs, this.hasher, this.prompter).execute({
      mergeFiles: options.manifest.getMergeFiles(options.toolId),
      distMap,
      projectRoot: options.projectRoot,
      force: options.force,
      interactive: options.interactive,
      fileFilter: options.fileFilter,
    });
  }

  private commitToolRestore(
    options: RestoreToolFilesOptions,
    toolId: ToolId,
    section: SectionRestoreResult | null,
    mergeSection: MergeSectionRestoreResult | null
  ): RestoreToolFilesResult {
    const { manifest, version } = options;
    const files =
      section?.updatedFiles ?? this.existingFilesAsGenerated(manifest.getToolFiles(toolId));
    const mergeFiles = mergeSection?.updatedMergeFiles ?? [...manifest.getMergeFiles(toolId)];
    manifest.addTool(toolId, manifest.getToolVersion(toolId) ?? version, files, mergeFiles);
    const restored = [...(section?.restored ?? []), ...(mergeSection?.restored ?? [])];
    const kept = [...(section?.kept ?? []), ...(mergeSection?.kept ?? [])];
    const unrestorable = [...(section?.unrestorable ?? []), ...(mergeSection?.unrestorable ?? [])];
    return { toolId, nothingToRestore: false, restored, kept, unrestorable };
  }

  private existingFilesAsGenerated(
    files: ReadonlyArray<{ relativePath: string; hash: FileHash }>
  ): InstallationFile[] {
    return files.map(
      (f) => new InstallationFile({ relativePath: f.relativePath, content: "", hash: f.hash })
    );
  }
}
