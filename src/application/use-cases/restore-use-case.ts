import { join } from "node:path";
import { generateForConfig } from "../../domain/models/distribution.js";
import { buildDocsDistribution } from "../../domain/models/docs.js";
import type { FileHash } from "../../domain/models/file-hash.js";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import type { Manifest } from "../../domain/models/manifest.js";
import { extractMergeEntries, type MergeFileEntry } from "../../domain/models/merge-entry.js";
import type { MergeStrategy } from "../../domain/models/merge-strategy.js";
import { getToolConfig, type ToolId } from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { Platform } from "../../domain/ports/platform.js";
import type { Prompter } from "../../domain/ports/prompter.js";
import { InputRequiredError, NoManifestError } from "../errors.js";

interface RestoreOptions {
  frameworkPath: string;
  version: string;
  docsDir: string;
  projectRoot: string;
  toolIds?: ToolId[];
  docsOnly?: boolean;
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

interface RestoreDocsResult {
  nothingToRestore: boolean;
  restored: string[];
  kept: string[];
}

interface RestoreResult {
  tools: RestoreToolResult[];
  docs: RestoreDocsResult | null;
  totalRestored: number;
  totalKept: number;
}

interface DriftEntry {
  relativePath: string;
  content: string;
  reason: "deleted" | "modified";
}

interface RestorationResult {
  restored: string[];
  kept: string[];
  updatedHashMap: Map<string, FileHash>;
}

interface SectionRestoreResult {
  restored: string[];
  kept: string[];
  updatedFiles: GeneratedFile[];
}

interface MergeDriftEntry {
  relativePath: string;
  content: string;
  reason: "deleted" | "modified";
  mergeStrategy: MergeStrategy;
  sectionKey: string | null;
}

interface MergeSectionRestoreResult {
  restored: string[];
  kept: string[];
  updatedMergeFiles: MergeFileEntry[];
}

interface RestoreCtx {
  options: RestoreOptions;
  docsOnly: boolean;
  manifest: Manifest;
  descriptor: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["descriptor"];
  contentFiles: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["contentFiles"];
  docsFiles: Awaited<ReturnType<FrameworkLoader["loadFromDirectory"]>>["docsFiles"];
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
    private readonly prompter: Prompter
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
    const docsOnly = options.docsOnly ?? false;
    const manifest = options.manifest ?? (await this.manifestRepo.load());
    if (manifest === null) throw new NoManifestError(repo);

    const { descriptor, contentFiles, docsFiles } = await this.loader.loadFromDirectory(
      frameworkPath,
      version
    );
    const fileFilter = buildFileFilter(options.files);

    return this.executeRestore({
      options,
      docsOnly,
      manifest,
      descriptor,
      contentFiles,
      docsFiles,
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
      docsOnly,
      manifest,
      descriptor,
      contentFiles,
      docsFiles,
      docsDir,
      projectRoot,
      version,
      force,
      interactive,
      fileFilter,
    } = ctx;
    const toolIds = this.resolveToolIds(options, docsOnly, manifest);
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
    const hasExplicitToolFilter =
      !docsOnly && options.toolIds !== undefined && options.toolIds.length > 0;
    const docsResult = hasExplicitToolFilter
      ? null
      : await this.restoreDocs(
          manifest,
          docsFiles,
          docsDir,
          projectRoot,
          version,
          force,
          interactive,
          fileFilter
        );
    const hasChanges =
      toolResults.some((t) => t.restored.length > 0) ||
      (docsResult !== null && docsResult.restored.length > 0);
    if (hasChanges) await this.manifestRepo.save(manifest);
    return this.buildRestoreTotals(toolResults, docsResult);
  }

  private resolveToolIds(options: RestoreOptions, docsOnly: boolean, manifest: Manifest): ToolId[] {
    if (docsOnly) return [];
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
    const distribution = await generateForConfig(
      config,
      descriptor,
      docsDir,
      contentFiles,
      this.hasher,
      this.platform,
      projectRoot,
      this.fs
    );
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
  ): GeneratedFile[] {
    return files.map(
      (f) => new GeneratedFile({ relativePath: f.relativePath, content: "", hash: f.hash })
    );
  }

  private async restoreMergeSection(
    mergeFiles: readonly MergeFileEntry[],
    distMap: Map<string, GeneratedFile>,
    projectRoot: string,
    force: boolean,
    interactive: boolean,
    fileFilter: ((p: string) => boolean) | null
  ): Promise<MergeSectionRestoreResult | null> {
    const drift = await this.collectMergeDrift(mergeFiles, distMap, projectRoot, fileFilter);
    if (drift.length === 0) return null;
    return this.applyMergeRestorations(drift, mergeFiles, projectRoot, force, interactive);
  }

  private async collectMergeDrift(
    mergeFiles: readonly MergeFileEntry[],
    distMap: Map<string, GeneratedFile>,
    projectRoot: string,
    fileFilter: ((p: string) => boolean) | null
  ): Promise<MergeDriftEntry[]> {
    const drift: MergeDriftEntry[] = [];
    for (const entry of mergeFiles) {
      if (fileFilter && !fileFilter(entry.relativePath)) continue;
      const distFile = distMap.get(entry.relativePath);
      if (!distFile || distFile.mergeStrategy === "none") continue;
      const driftEntry = await this.checkOneMergeFileDrift(entry, distFile, projectRoot);
      if (driftEntry) drift.push(driftEntry);
    }
    return drift;
  }

  private async checkOneMergeFileDrift(
    entry: MergeFileEntry,
    distFile: GeneratedFile,
    projectRoot: string
  ): Promise<MergeDriftEntry | null> {
    const diskPath = join(projectRoot, entry.relativePath);
    const diskExists = await this.fs.fileExists(diskPath);
    if (!diskExists) {
      return {
        relativePath: entry.relativePath,
        content: distFile.content,
        reason: "deleted",
        mergeStrategy: distFile.mergeStrategy,
        sectionKey: entry.sectionKey,
      };
    }
    const diskContent = await this.fs.readFile(diskPath);
    const diskEntries = extractMergeEntries(diskContent, entry.sectionKey, this.hasher);
    const hasDrift = Object.keys(entry.entries).some(
      (key) => diskEntries[key]?.value !== entry.entries[key].value
    );
    if (!hasDrift) return null;
    return {
      relativePath: entry.relativePath,
      content: distFile.content,
      reason: "modified",
      mergeStrategy: distFile.mergeStrategy,
      sectionKey: entry.sectionKey,
    };
  }

  private async applyMergeRestorations(
    drift: MergeDriftEntry[],
    mergeFiles: readonly MergeFileEntry[],
    projectRoot: string,
    force: boolean,
    interactive: boolean
  ): Promise<MergeSectionRestoreResult> {
    const restored: string[] = [];
    const kept: string[] = [];
    const mergeMap = new Map(mergeFiles.map((m) => [m.relativePath, m]));
    for (const entry of drift) {
      const skip = await this.resolveRestoreDecision(
        entry.relativePath,
        entry.reason,
        force,
        interactive
      );
      if (skip) {
        kept.push(entry.relativePath);
        continue;
      }
      await this.applyOneMergeRestore(entry, projectRoot, mergeMap);
      restored.push(entry.relativePath);
    }
    return { restored, kept, updatedMergeFiles: [...mergeMap.values()] };
  }

  /**
   * Returns true when the file should be kept (skipped), false when it should be restored.
   * Throws InputRequiredError when a modified file is encountered in non-interactive non-force mode.
   */
  private async resolveRestoreDecision(
    relativePath: string,
    reason: "deleted" | "modified",
    force: boolean,
    interactive: boolean
  ): Promise<boolean> {
    if (reason !== "modified") return false;
    if (!force && !interactive) {
      throw new InputRequiredError(
        `Use --force to overwrite modified files in non-interactive mode.`
      );
    }
    if (!force && interactive) {
      const decision = await this.prompter.resolveConflict(relativePath, reason);
      return decision === "keep";
    }
    return false;
  }

  private async applyOneMergeRestore(
    entry: MergeDriftEntry,
    projectRoot: string,
    mergeMap: Map<string, MergeFileEntry>
  ): Promise<void> {
    const fullPath = join(projectRoot, entry.relativePath);
    await this.fs.mergeJsonFile(fullPath, entry.content, entry.mergeStrategy);
    const mergedContent = await this.fs.readFile(fullPath);
    const newEntries = extractMergeEntries(mergedContent, entry.sectionKey, this.hasher);
    mergeMap.set(entry.relativePath, {
      relativePath: entry.relativePath,
      sectionKey: entry.sectionKey,
      entries: newEntries,
    });
  }

  /** Shared restoration logic for both tool files and docs files. Returns null when nothing to restore. */
  private async restoreSection(
    manifestFiles: ReadonlyArray<{ relativePath: string; hash: FileHash }>,
    distMap: Map<string, GeneratedFile>,
    projectRoot: string,
    force: boolean,
    interactive: boolean,
    fileFilter: ((p: string) => boolean) | null
  ): Promise<SectionRestoreResult | null> {
    const drift = await this.collectDrift(manifestFiles, distMap, projectRoot, fileFilter);
    if (drift.length === 0) return null;

    const { restored, kept, updatedHashMap } = await this.applyRestorations(
      drift,
      new Map(manifestFiles.map((f) => [f.relativePath, f.hash])),
      projectRoot,
      force,
      interactive
    );

    const updatedFiles = Array.from(updatedHashMap.entries()).map(
      ([relativePath, hash]) => new GeneratedFile({ relativePath, content: "", hash })
    );

    return { restored, kept, updatedFiles };
  }

  private async restoreDocs(
    manifest: Manifest,
    docsFiles: Map<string, string>,
    docsDir: string,
    projectRoot: string,
    version: string,
    force: boolean,
    interactive: boolean,
    fileFilter: ((p: string) => boolean) | null
  ): Promise<RestoreDocsResult | null> {
    const docsManifestFiles = manifest.getDocsFiles();
    const filesIncludeDocs =
      fileFilter === null || docsManifestFiles.some((f) => fileFilter(f.relativePath));

    if (!manifest.hasDocs() || !filesIncludeDocs) return null;

    this.logger.info("Checking docs for files to restore...");

    const distribution = buildDocsDistribution(docsFiles, docsDir, this.hasher);
    const distMap = new Map(distribution.map((f) => [f.relativePath, f]));

    const section = await this.restoreSection(
      docsManifestFiles,
      distMap,
      projectRoot,
      force,
      interactive,
      fileFilter
    );
    if (section === null) return { nothingToRestore: true, restored: [], kept: [] };

    manifest.addDocs(manifest.getDocsVersion() ?? version, section.updatedFiles);
    return { nothingToRestore: false, restored: section.restored, kept: section.kept };
  }

  private buildRestoreTotals(
    toolResults: RestoreToolResult[],
    docsResult: RestoreDocsResult | null
  ): RestoreResult {
    const totalRestored =
      toolResults.reduce((s, t) => s + t.restored.length, 0) + (docsResult?.restored.length ?? 0);
    const totalKept =
      toolResults.reduce((s, t) => s + t.kept.length, 0) + (docsResult?.kept.length ?? 0);
    return { tools: toolResults, docs: docsResult, totalRestored, totalKept };
  }

  private async collectDrift(
    manifestFiles: ReadonlyArray<{ relativePath: string; hash: { value: string } }>,
    distMap: Map<string, GeneratedFile>,
    projectRoot: string,
    fileFilter: ((p: string) => boolean) | null
  ): Promise<DriftEntry[]> {
    const drift: DriftEntry[] = [];

    for (const manifestFile of manifestFiles) {
      if (fileFilter && !fileFilter(manifestFile.relativePath)) continue;

      const diskPath = join(projectRoot, manifestFile.relativePath);
      const diskExists = await this.fs.fileExists(diskPath);

      if (!diskExists) {
        const distFile = distMap.get(manifestFile.relativePath);
        if (distFile)
          drift.push({
            relativePath: manifestFile.relativePath,
            content: distFile.content,
            reason: "deleted",
          });
        continue;
      }

      const diskHash = await this.fs.readFileHash(diskPath);
      if (diskHash.value !== manifestFile.hash.value) {
        const distFile = distMap.get(manifestFile.relativePath);
        if (distFile)
          drift.push({
            relativePath: manifestFile.relativePath,
            content: distFile.content,
            reason: "modified",
          });
      }
    }

    return drift;
  }

  private async applyRestorations(
    drift: DriftEntry[],
    initialHashMap: Map<string, FileHash>,
    projectRoot: string,
    force: boolean,
    interactive: boolean
  ): Promise<RestorationResult> {
    const restored: string[] = [];
    const kept: string[] = [];
    const updatedHashMap = new Map(initialHashMap);

    for (const { relativePath, content, reason } of drift) {
      const skip = await this.resolveRestoreDecision(relativePath, reason, force, interactive);
      if (skip) {
        kept.push(relativePath);
        continue;
      }
      await this.fs.writeFile(join(projectRoot, relativePath), content);
      const newHash = await this.fs.readFileHash(join(projectRoot, relativePath));
      updatedHashMap.set(relativePath, newHash);
      restored.push(relativePath);
    }

    return { restored, kept, updatedHashMap };
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
