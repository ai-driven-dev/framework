import type { FileHash } from "../../../../shared/domain/file-hash.js";
import { InstallationFile } from "../../../../shared/domain/installation-file.js";
import type { MergeFileEntry } from "../../../../shared/domain/merge.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { Prompter } from "../../../../shared/ports/prompter.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { FrameworkDescriptor } from "../../domain/canon.js";
import type { Manifest } from "../../domain/manifest.js";
import type { FileMerger } from "../../ports/file-merger.js";
import type { RestoredTool } from "../../ports/tool-sections.js";
import type { GenerateToolDistribution } from "./generate-tool-distribution.js";
import { restoreMergeFiles } from "./restore-merge-files.js";
import { restoreRegularFiles } from "./restore-regular-files.js";

export interface RestoreToolFilesCommand {
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

export class RestoreToolFiles {
  constructor(
    private readonly generateToolDistribution: GenerateToolDistribution,
    private readonly fs: FileReader & FileWriter & FileMerger,
    private readonly prompter: Prompter,
    private readonly logger: Logger,
    private readonly tools: ToolCatalog
  ) {}

  async execute(options: RestoreToolFilesCommand): Promise<RestoreToolFilesResult> {
    this.logger.info(`Checking ${options.toolId} for files to restore...`);
    const config = this.tools.profile(options.toolId);
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
    options: RestoreToolFilesCommand,
    config: RestoredTool
  ): Promise<Map<string, InstallationFile>> {
    const { descriptor, contentFiles, projectRoot } = options;
    const distribution = await this.generateToolDistribution.execute({
      config,
      descriptor,
      contentFiles,
      projectRoot,
    });
    return new Map(distribution.map((f) => [f.relativePath, f]));
  }

  private async restoreSection(
    options: RestoreToolFilesCommand,
    distMap: Map<string, InstallationFile>
  ): Promise<SectionRestoreResult | null> {
    return restoreRegularFiles(this.fs, this.prompter, {
      manifestFiles: options.manifest.getToolFiles(options.toolId),
      distMap,
      projectRoot: options.projectRoot,
      force: options.force,
      interactive: options.interactive,
      fileFilter: options.fileFilter,
    });
  }

  private async restoreMergeSection(
    options: RestoreToolFilesCommand,
    distMap: Map<string, InstallationFile>
  ): Promise<MergeSectionRestoreResult | null> {
    return restoreMergeFiles(this.fs, this.prompter, {
      mergeFiles: options.manifest.getMergeFiles(options.toolId),
      distMap,
      projectRoot: options.projectRoot,
      force: options.force,
      interactive: options.interactive,
      fileFilter: options.fileFilter,
    });
  }

  private commitToolRestore(
    options: RestoreToolFilesCommand,
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
