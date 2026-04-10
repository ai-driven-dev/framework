import { join } from "node:path";
import { generateDistribution } from "../../domain/models/distribution.js";
import { buildDocsDistribution } from "../../domain/models/docs.js";
import type { FileHash } from "../../domain/models/file-hash.js";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import type { Manifest } from "../../domain/models/manifest.js";
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
    const manifestFiles = manifest.getToolFiles(toolId);
    const distribution = await generateDistribution(
      descriptor,
      config,
      docsDir,
      contentFiles,
      this.hasher,
      this.platform,
      projectRoot,
      this.fs
    );
    const distMap = new Map(distribution.map((f) => [f.relativePath, f]));
    const section = await this.restoreSection(
      manifestFiles,
      distMap,
      projectRoot,
      force,
      interactive,
      fileFilter
    );

    if (section === null) return { toolId, nothingToRestore: true, restored: [], kept: [] };

    const existingMergeFiles = [...manifest.getMergeFiles(toolId)];
    manifest.addTool(
      toolId,
      manifest.getToolVersion(toolId) ?? version,
      section.updatedFiles,
      existingMergeFiles
    );
    return { toolId, nothingToRestore: false, restored: section.restored, kept: section.kept };
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
      if (reason === "modified") {
        if (!force && !interactive) {
          throw new InputRequiredError(
            `Use --force to overwrite modified files in non-interactive mode.`
          );
        }
        if (!force && interactive) {
          const decision = await this.prompter.resolveConflict(relativePath, reason);
          if (decision === "keep") {
            kept.push(relativePath);
            continue;
          }
        }
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
