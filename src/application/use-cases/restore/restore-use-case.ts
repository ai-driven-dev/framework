import { join } from "node:path";
import { type FileHash, InstallationFile } from "../../../domain/models/file.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import type { MergeFileEntry } from "../../../domain/models/merge.js";
import { PLUGIN_CACHE_SUBDIR } from "../../../domain/models/paths.js";
import { AI_TOOL_IDS } from "../../../domain/models/tool-ids.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../../domain/ports/framework-loader.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { Logger } from "../../../domain/ports/logger.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import type { Platform } from "../../../domain/ports/platform.js";
import type { PluginDistributionReader } from "../../../domain/ports/plugin-distribution-reader.js";
import type { PluginFetcher } from "../../../domain/ports/plugin-fetcher.js";
import type { Prompter } from "../../../domain/ports/prompter.js";
import { getToolConfig, isAiTool, type ToolId } from "../../../domain/tools/registry.js";
import { NoManifestError } from "../../errors.js";
import { ApplyPluginFilesUseCase } from "../shared/apply-plugin-files-use-case.js";
import { GenerateToolDistributionUseCase } from "../shared/generate-tool-distribution-use-case.js";
import { RestoreMergeFilesUseCase } from "../shared/restore-merge-files-use-case.js";
import { RestoreRegularFilesUseCase } from "../shared/restore-regular-files-use-case.js";

interface RestoreOptions {
  frameworkPath?: string;
  version?: string;
  docsDir?: string;
  projectRoot: string;
  toolIds?: ToolId[];
  files?: string[];
  force?: boolean;
  interactive?: boolean;
  manifest?: Manifest;
  repo?: string;
}

interface RestoreToolResult {
  toolId: ToolId;
  nothingToRestore: boolean;
  restored: string[];
  kept: string[];
}

interface RestoreResult {
  tools: RestoreToolResult[];
  totalRestored: number;
  totalKept: number;
  totalPluginFilesRestored: number;
}

interface SectionRestoreResult {
  restored: string[];
  kept: string[];
  updatedFiles: InstallationFile[];
}

interface MergeSectionRestoreResult {
  restored: string[];
  kept: string[];
  updatedMergeFiles: MergeFileEntry[];
}

interface RestoreCtx {
  options: RestoreOptions;
  manifest: Manifest;
  descriptor: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["descriptor"];
  contentFiles: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["contentFiles"];
  docsDir: string;
  projectRoot: string;
  version: string;
  force: boolean;
  interactive: boolean;
  fileFilter: ((p: string) => boolean) | null;
}

export class RestoreUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly loader: FrameworkLoader,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly platform: Platform,
    private readonly prompter: Prompter,
    private readonly pluginFetcher?: PluginFetcher,
    private readonly pluginDistributionReader?: PluginDistributionReader
  ) {}

  async execute(options: RestoreOptions): Promise<RestoreResult> {
    const {
      frameworkPath,
      version,
      docsDir,
      projectRoot,
      force = false,
      interactive = false,
      repo,
    } = options;

    if (frameworkPath === undefined || version === undefined || docsDir === undefined) {
      throw new Error("frameworkPath, version, and docsDir are required for non-plugin restore.");
    }

    const manifest = options.manifest ?? (await this.manifestRepo.load());
    if (manifest === null) throw new NoManifestError(repo);

    const { descriptor, contentFiles } = await this.loader.loadFromDirectory(
      frameworkPath,
      version
    );
    const fileFilter = buildFileFilter(options.files);

    return this.executeRestore({
      options,
      manifest,
      descriptor,
      contentFiles,
      docsDir,
      projectRoot,
      version,
      force,
      interactive,
      fileFilter,
    });
  }

  private async executeRestore(ctx: RestoreCtx): Promise<RestoreResult> {
    const {
      options,
      manifest,
      descriptor,
      contentFiles,
      docsDir,
      projectRoot,
      version,
      force,
      interactive,
      fileFilter,
    } = ctx;
    const toolIds = this.resolveToolIds(options, manifest);
    const toolResults = await this.restoreAllTools(
      toolIds,
      manifest,
      descriptor,
      contentFiles,
      docsDir,
      projectRoot,
      version,
      force,
      interactive,
      fileFilter
    );
    const totalPluginFilesRestored = await this.restoreAllPlugins(projectRoot, manifest, docsDir);
    const hasChanges =
      toolResults.some((t) => t.restored.length > 0) || totalPluginFilesRestored > 0;
    if (hasChanges) await this.manifestRepo.save(manifest);
    return this.buildRestoreTotals(toolResults, totalPluginFilesRestored);
  }

  private async restoreAllPlugins(
    projectRoot: string,
    manifest: Manifest,
    docsDir: string
  ): Promise<number> {
    if (this.pluginFetcher === undefined || this.pluginDistributionReader === undefined) return 0;
    const applyUseCase = new ApplyPluginFilesUseCase(
      this.fs,
      this.hasher,
      this.pluginFetcher,
      this.pluginDistributionReader
    );
    const cacheDir = join(projectRoot, PLUGIN_CACHE_SUBDIR);
    let total = 0;
    for (const toolId of AI_TOOL_IDS) {
      if (!manifest.hasTool(toolId)) continue;
      const toolConfig = getToolConfig(toolId);
      if (!isAiTool(toolConfig)) continue;
      for (const plugin of manifest.getPlugins(toolId)) {
        total += await applyUseCase.execute({
          toolId,
          plugin,
          toolConfig,
          projectRoot,
          cacheDir,
          manifest,
          docsDir,
        });
      }
    }
    return total;
  }

  private resolveToolIds(options: RestoreOptions, manifest: Manifest): ToolId[] {
    return options.toolIds?.length ? options.toolIds : manifest.getInstalledToolIds();
  }

  private async restoreAllTools(
    toolIds: ToolId[],
    manifest: Manifest,
    descriptor: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["descriptor"],
    contentFiles: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["contentFiles"],
    docsDir: string,
    projectRoot: string,
    version: string,
    force: boolean,
    interactive: boolean,
    fileFilter: ((p: string) => boolean) | null
  ): Promise<RestoreToolResult[]> {
    const toolResults: RestoreToolResult[] = [];
    for (const toolId of toolIds) {
      const result = await this.restoreOneTool(
        toolId,
        manifest,
        descriptor,
        contentFiles,
        docsDir,
        projectRoot,
        version,
        force,
        interactive,
        fileFilter
      );
      toolResults.push(result);
    }
    return toolResults;
  }

  private async restoreOneTool(
    toolId: ToolId,
    manifest: Manifest,
    descriptor: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["descriptor"],
    contentFiles: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["contentFiles"],
    docsDir: string,
    projectRoot: string,
    version: string,
    force: boolean,
    interactive: boolean,
    fileFilter: ((p: string) => boolean) | null
  ): Promise<RestoreToolResult> {
    this.logger.info(`Checking ${toolId} for files to restore...`);
    const config = getToolConfig(toolId);
    const distribution = await new GenerateToolDistributionUseCase(
      this.fs,
      this.hasher,
      this.platform
    ).execute({ config, descriptor, contentFiles, docsDir, projectRoot });
    const distMap = new Map(distribution.map((f) => [f.relativePath, f]));
    const section = await this.restoreSection(
      manifest.getToolFiles(toolId),
      distMap,
      projectRoot,
      force,
      interactive,
      fileFilter
    );
    const mergeSection = await this.restoreMergeSection(
      manifest.getMergeFiles(toolId),
      distMap,
      projectRoot,
      force,
      interactive,
      fileFilter
    );
    if (section === null && mergeSection === null) {
      return { toolId, nothingToRestore: true, restored: [], kept: [] };
    }
    return this.commitToolRestore(toolId, manifest, version, section, mergeSection);
  }

  private commitToolRestore(
    toolId: ToolId,
    manifest: Manifest,
    version: string,
    section: SectionRestoreResult | null,
    mergeSection: MergeSectionRestoreResult | null
  ): RestoreToolResult {
    const files =
      section?.updatedFiles ?? this.existingFilesAsGenerated(manifest.getToolFiles(toolId));
    const mergeFiles = mergeSection?.updatedMergeFiles ?? [...manifest.getMergeFiles(toolId)];
    manifest.addTool(toolId, manifest.getToolVersion(toolId) ?? version, files, mergeFiles);
    const restored = [...(section?.restored ?? []), ...(mergeSection?.restored ?? [])];
    const kept = [...(section?.kept ?? []), ...(mergeSection?.kept ?? [])];
    return { toolId, nothingToRestore: false, restored, kept };
  }

  private existingFilesAsGenerated(
    files: ReadonlyArray<{ relativePath: string; hash: FileHash }>
  ): InstallationFile[] {
    return files.map(
      (f) => new InstallationFile({ relativePath: f.relativePath, content: "", hash: f.hash })
    );
  }

  private async restoreSection(
    manifestFiles: ReadonlyArray<{ relativePath: string; hash: FileHash }>,
    distMap: Map<string, InstallationFile>,
    projectRoot: string,
    force: boolean,
    interactive: boolean,
    fileFilter: ((p: string) => boolean) | null
  ): Promise<SectionRestoreResult | null> {
    return new RestoreRegularFilesUseCase(this.fs, this.prompter).execute({
      manifestFiles,
      distMap,
      projectRoot,
      force,
      interactive,
      fileFilter,
    });
  }

  private async restoreMergeSection(
    mergeFiles: readonly MergeFileEntry[],
    distMap: Map<string, InstallationFile>,
    projectRoot: string,
    force: boolean,
    interactive: boolean,
    fileFilter: ((p: string) => boolean) | null
  ): Promise<MergeSectionRestoreResult | null> {
    return new RestoreMergeFilesUseCase(this.fs, this.hasher, this.prompter).execute({
      mergeFiles,
      distMap,
      projectRoot,
      force,
      interactive,
      fileFilter,
    });
  }

  private buildRestoreTotals(
    toolResults: RestoreToolResult[],
    totalPluginFilesRestored: number
  ): RestoreResult {
    const totalRestored = toolResults.reduce((s, t) => s + t.restored.length, 0);
    const totalKept = toolResults.reduce((s, t) => s + t.kept.length, 0);
    return {
      tools: toolResults,
      totalRestored,
      totalKept,
      totalPluginFilesRestored,
    };
  }
}

function buildFileFilter(files: string[] | undefined): ((p: string) => boolean) | null {
  if (!files || files.length === 0) return null;
  return (relativePath: string) =>
    files.some((entry) => {
      const basename = entry.split("/").at(-1) ?? entry;
      const isDirectoryPrefix = entry.endsWith("/") || !basename.includes(".");
      if (isDirectoryPrefix) {
        const prefix = entry.endsWith("/") ? entry : `${entry}/`;
        return relativePath.startsWith(prefix);
      }
      return relativePath === entry;
    });
}
