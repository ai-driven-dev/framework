import { join } from "node:path";
import { parseFrontmatter, serializeFrontmatter } from "../../domain/models/frontmatter.js";
import { isSyncExcluded } from "../../domain/models/sync-exclusions.js";
import {
  getToolConfig,
  type SectionHandler,
  type ToolConfig,
  type ToolId,
  type UserFileSectionKey,
} from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { Prompter } from "../../domain/ports/prompter.js";
import { NoManifestError } from "../errors.js";

interface SyncOptions {
  projectRoot: string;
  docsDir?: string;
  sourceTool?: ToolId;
  targetTools?: ToolId[];
  force?: boolean;
  includeUserFiles?: boolean;
  repo?: string;
  interactive?: boolean;
}

interface SyncFileResult {
  relativePath: string;
  conflict: boolean;
  skipped: boolean;
  written: boolean;
  deleted?: boolean;
}

interface SyncToolResult {
  targetToolId: ToolId;
  files: SyncFileResult[];
}

interface PropagateModifiedCtx {
  sourceManifestFiles: ReadonlyArray<{
    relativePath: string;
    hash: { value: string };
    frameworkPath?: string;
  }>;
  sourceConfig: ToolConfig;
  targetConfig: ToolConfig;
  targetManifestMap: Map<string, { value: string }>;
  targetByFrameworkPath: Map<string, string>;
  fileResults: SyncFileResult[];
  projectRoot: string;
  docsDir: string;
  force: boolean;
}

interface SyncResult {
  sourceTool: ToolId;
  tools: SyncToolResult[];
  totalWritten: number;
  totalDeleted: number;
  totalConflicts: number;
  totalSkipped: number;
}

function getSectionKeyFromFrameworkPath(frameworkPath: string): UserFileSectionKey | null {
  if (frameworkPath.startsWith("agents/"))
    return { section: "agents", key: frameworkPath.slice("agents/".length) };
  if (frameworkPath.startsWith("commands/"))
    return { section: "commands", key: frameworkPath.slice("commands/".length) };
  if (frameworkPath.startsWith("rules/"))
    return { section: "rules", key: frameworkPath.slice("rules/".length) };
  if (frameworkPath.startsWith("skills/"))
    return { section: "skills", key: frameworkPath.slice("skills/".length) };
  return null;
}

function transformContent(
  content: string,
  sourceConfig: ToolConfig,
  targetConfig: ToolConfig,
  sectionKey: UserFileSectionKey,
  docsDir: string
): string {
  const { frontmatter, body } = parseFrontmatter(content);

  const canonicalFrontmatter =
    sourceConfig[sectionKey.section]().reverseConvertFrontmatter(frontmatter);

  const targetFrontmatter =
    sectionKey.section === "commands"
      ? targetConfig.commands().convertFrontmatter(canonicalFrontmatter, sectionKey.key)
      : (targetConfig[sectionKey.section]() as SectionHandler).convertFrontmatter(
          canonicalFrontmatter,
          sectionKey.key
        );

  const canonicalBody = sourceConfig.reverseRewriteContent(body, docsDir);
  const targetBody = targetConfig.rewriteContent(canonicalBody, docsDir);

  return serializeFrontmatter(targetFrontmatter, targetBody);
}

function buildTargetPath(targetConfig: ToolConfig, sectionKey: UserFileSectionKey): string | null {
  return targetConfig[sectionKey.section]().buildFilePath(sectionKey.key);
}

export class SyncUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    readonly _hasher: Hasher,
    private readonly logger: Logger,
    private readonly prompter?: Prompter
  ) {}

  async execute(options: SyncOptions): Promise<SyncResult> {
    const { projectRoot, force = false, includeUserFiles = false, repo } = options;
    const manifest = await this.manifestRepo.load();
    if (manifest === null) throw new NoManifestError(repo);

    const docsDir = options.docsDir ?? manifest.docsDir;
    const { sourceTool, targetTools } = await this.selectSyncScope(
      options,
      manifest,
      options.interactive ?? false
    );
    const sourceConfig = getToolConfig(sourceTool);
    const sourceManifestFiles = manifest.getToolFiles(sourceTool);
    const sourceManifestMap = new Map(sourceManifestFiles.map((f) => [f.relativePath, f.hash]));

    const toolResults = await this.syncAllTargets(
      targetTools,
      sourceTool,
      sourceConfig,
      sourceManifestFiles,
      sourceManifestMap,
      manifest,
      projectRoot,
      docsDir,
      force,
      includeUserFiles
    );

    return this.buildSyncTotals(sourceTool, toolResults);
  }

  private async syncAllTargets(
    targetTools: ToolId[],
    sourceTool: ToolId,
    sourceConfig: ReturnType<typeof getToolConfig>,
    sourceManifestFiles: ReadonlyArray<{
      relativePath: string;
      hash: { value: string };
      frameworkPath?: string;
    }>,
    sourceManifestMap: Map<string, { value: string }>,
    manifest: Awaited<ReturnType<ManifestRepository["load"]>> & object,
    projectRoot: string,
    docsDir: string,
    force: boolean,
    includeUserFiles: boolean
  ): Promise<SyncToolResult[]> {
    const toolResults: SyncToolResult[] = [];
    for (const targetToolId of targetTools) {
      this.logger.info(`Syncing ${sourceTool} → ${targetToolId}...`);
      const result = await this.syncOneTool(
        targetToolId,
        sourceConfig,
        sourceManifestFiles,
        sourceManifestMap,
        manifest,
        projectRoot,
        docsDir,
        force,
        includeUserFiles
      );
      toolResults.push(result);
    }
    return toolResults;
  }

  private async syncOneTool(
    targetToolId: ToolId,
    sourceConfig: ReturnType<typeof getToolConfig>,
    sourceManifestFiles: ReadonlyArray<{
      relativePath: string;
      hash: { value: string };
      frameworkPath?: string;
    }>,
    sourceManifestMap: Map<string, { value: string }>,
    manifest: Awaited<ReturnType<ManifestRepository["load"]>> & object,
    projectRoot: string,
    docsDir: string,
    force: boolean,
    includeUserFiles: boolean
  ): Promise<SyncToolResult> {
    const targetConfig = getToolConfig(targetToolId);
    const targetManifestFiles = manifest.getToolFiles(targetToolId);
    const targetManifestMap = new Map(targetManifestFiles.map((f) => [f.relativePath, f.hash]));
    const targetByFrameworkPath = new Map(
      targetManifestFiles
        .filter((f): f is typeof f & { frameworkPath: string } => f.frameworkPath !== undefined)
        .map((f) => [f.frameworkPath, f.relativePath])
    );
    const fileResults: SyncFileResult[] = [];
    await this.propagateModified({
      sourceManifestFiles,
      sourceConfig,
      targetConfig,
      targetManifestMap,
      targetByFrameworkPath,
      fileResults,
      projectRoot,
      docsDir,
      force,
    });
    await this.propagateAdded({
      sourceManifestMap,
      sourceConfig,
      targetConfig,
      fileResults,
      projectRoot,
      docsDir,
      includeUserFiles,
    });
    await this.propagateDeleted({
      sourceManifestFiles,
      targetByFrameworkPath,
      fileResults,
      projectRoot,
      docsDir,
    });
    return { targetToolId, files: fileResults };
  }

  /** Resolves sourceTool and targetTools from options — prompts if interactive. */
  private async selectSyncScope(
    options: SyncOptions,
    manifest: Awaited<ReturnType<ManifestRepository["load"]>> & object,
    interactive: boolean
  ): Promise<{ sourceTool: ToolId; targetTools: ToolId[] }> {
    if (options.sourceTool !== undefined) {
      return this.resolveExplicitScope(options, manifest);
    }
    return this.resolveInteractiveScope(manifest, interactive, options.projectRoot);
  }

  private resolveExplicitScope(
    options: SyncOptions,
    manifest: Awaited<ReturnType<ManifestRepository["load"]>> & object
  ): { sourceTool: ToolId; targetTools: ToolId[] } {
    const sourceTool = options.sourceTool as ToolId;

    if (!manifest.hasTool(sourceTool)) {
      throw new Error(`Source tool '${sourceTool}' is not installed.`);
    }

    const installedToolIds = manifest.getInstalledToolIds();

    if (installedToolIds.length < 2) {
      throw new Error("Sync requires at least 2 installed tools.");
    }

    const targetTools =
      options.targetTools && options.targetTools.length > 0
        ? options.targetTools
        : installedToolIds.filter((id) => id !== sourceTool);

    for (const target of targetTools) {
      if (target === sourceTool) {
        throw new Error("Source and target cannot be the same tool.");
      }
      if (!manifest.hasTool(target)) {
        throw new Error(`Target tool '${target}' is not installed.`);
      }
    }

    return { sourceTool, targetTools };
  }

  private async resolveInteractiveScope(
    manifest: Awaited<ReturnType<ManifestRepository["load"]>> & object,
    interactive: boolean,
    projectRoot: string
  ): Promise<{ sourceTool: ToolId; targetTools: ToolId[] }> {
    if (!interactive || this.prompter === undefined) {
      throw new Error("Source tool required in non-interactive mode.");
    }

    const { SyncStatusUseCase } = await import("./sync-status-use-case.js");
    const installedIds = manifest.getInstalledToolIds();

    if (installedIds.length < 2) {
      throw new Error("Sync requires at least 2 installed tools.");
    }

    const modCounts = await new SyncStatusUseCase(this.fs).execute(
      manifest,
      installedIds as ToolId[],
      projectRoot
    );

    const hasAnyChanges = installedIds.some((id) => {
      const { modified, deleted } = modCounts[id] ?? { modified: 0, deleted: 0 };
      return modified > 0 || deleted > 0;
    });

    if (!hasAnyChanges) {
      return { sourceTool: installedIds[0] as ToolId, targetTools: [] };
    }

    return this.promptSyncScope(installedIds as ToolId[], modCounts, this.prompter);
  }

  private async promptSyncScope(
    installedIds: ToolId[],
    modCounts: Record<string, { modified: number; deleted: number }>,
    prompter: Prompter
  ): Promise<{ sourceTool: ToolId; targetTools: ToolId[] }> {
    const sourceChoices = installedIds.map((id) => {
      const { modified, deleted } = modCounts[id] ?? { modified: 0, deleted: 0 };
      const hasChanges = modified > 0 || deleted > 0;
      const parts: string[] = [];
      if (modified > 0) parts.push(`${modified} modified`);
      if (deleted > 0) parts.push(`${deleted} deleted`);
      const label = hasChanges ? ` (${parts.join(", ")})` : "";
      return {
        name: `${id}${label}`,
        value: id as ToolId,
        disabled: hasChanges ? false : "(no changes)",
      };
    });

    const sourceTool = await prompter.select("Source tool to sync from?", sourceChoices);

    const targetChoices = installedIds
      .filter((id) => id !== sourceTool)
      .map((id) => ({ name: id, value: id as ToolId }));

    const targetTools = await prompter.checkbox("Target tools?", targetChoices);
    if (targetTools.length === 0) throw new Error("No target tools selected.");

    return { sourceTool, targetTools };
  }

  private buildSyncTotals(sourceTool: ToolId, toolResults: SyncToolResult[]): SyncResult {
    const count = (pred: (f: SyncFileResult) => boolean) =>
      toolResults.reduce((s, t) => s + t.files.filter(pred).length, 0);

    return {
      sourceTool,
      tools: toolResults,
      totalWritten: count((f) => f.written),
      totalDeleted: count((f) => Boolean(f.deleted)),
      totalConflicts: count((f) => f.conflict && !f.written),
      totalSkipped: count((f) => f.skipped),
    };
  }

  private async propagateModified(ctx: PropagateModifiedCtx): Promise<void> {
    const {
      sourceManifestFiles,
      sourceConfig,
      targetConfig,
      targetManifestMap,
      targetByFrameworkPath,
      fileResults,
      projectRoot,
      docsDir,
      force,
    } = ctx;

    for (const sourceManifestFile of sourceManifestFiles) {
      await this.propagateOneModified(
        sourceManifestFile,
        sourceConfig,
        targetConfig,
        targetManifestMap,
        targetByFrameworkPath,
        fileResults,
        projectRoot,
        docsDir,
        force
      );
    }
  }

  private async propagateOneModified(
    sourceManifestFile: { relativePath: string; hash: { value: string }; frameworkPath?: string },
    sourceConfig: ToolConfig,
    targetConfig: ToolConfig,
    targetManifestMap: Map<string, { value: string }>,
    targetByFrameworkPath: Map<string, string>,
    fileResults: SyncFileResult[],
    projectRoot: string,
    docsDir: string,
    force: boolean
  ): Promise<void> {
    const { relativePath, hash: manifestHash, frameworkPath } = sourceManifestFile;
    if (isSyncExcluded(relativePath, docsDir) || frameworkPath === undefined) return;

    const diskSourcePath = join(projectRoot, relativePath);
    if (!(await this.fs.fileExists(diskSourcePath))) return;
    const diskSourceHash = await this.fs.readFileHash(diskSourcePath);
    if (diskSourceHash.value === manifestHash.value) return;

    const sectionKey = getSectionKeyFromFrameworkPath(frameworkPath);
    const targetRelativePath = targetByFrameworkPath.get(frameworkPath);
    if (sectionKey === null || targetRelativePath === undefined) return;

    const diskSourceContent = await this.fs.readFile(diskSourcePath);
    const targetContent = transformContent(
      diskSourceContent,
      sourceConfig,
      targetConfig,
      sectionKey,
      docsDir
    );

    const diskTargetPath = join(projectRoot, targetRelativePath);
    const diskTargetExists = await this.fs.fileExists(diskTargetPath);
    const conflict = await this.detectTargetConflict(
      diskTargetExists,
      diskTargetPath,
      targetRelativePath,
      targetManifestMap
    );

    if (diskTargetExists && (await this.fs.readFile(diskTargetPath)) === targetContent) {
      fileResults.push({
        relativePath: targetRelativePath,
        conflict: false,
        skipped: true,
        written: false,
      });
      return;
    }
    if (conflict && !force) {
      fileResults.push({
        relativePath: targetRelativePath,
        conflict: true,
        skipped: false,
        written: false,
      });
      return;
    }
    await this.fs.writeFile(diskTargetPath, targetContent);
    fileResults.push({ relativePath: targetRelativePath, conflict, skipped: false, written: true });
  }

  private async detectTargetConflict(
    diskTargetExists: boolean,
    diskTargetPath: string,
    targetRelativePath: string,
    targetManifestMap: Map<string, { value: string }>
  ): Promise<boolean> {
    if (!diskTargetExists) return false;
    const diskTargetHash = await this.fs.readFileHash(diskTargetPath);
    const targetManifestHash = targetManifestMap.get(targetRelativePath);
    return targetManifestHash !== undefined && diskTargetHash.value !== targetManifestHash.value;
  }

  private async propagateAdded(ctx: {
    sourceManifestMap: Map<string, { value: string }>;
    sourceConfig: ToolConfig;
    targetConfig: ToolConfig;
    fileResults: SyncFileResult[];
    projectRoot: string;
    docsDir: string;
    includeUserFiles: boolean;
  }): Promise<void> {
    const {
      sourceManifestMap,
      sourceConfig,
      targetConfig,
      fileResults,
      projectRoot,
      docsDir,
      includeUserFiles,
    } = ctx;
    if (!includeUserFiles) return;

    const sourceDirExists = await this.fs.fileExists(join(projectRoot, sourceConfig.directory));
    if (!sourceDirExists) return;

    const sourceDiskFiles = await this.fs.listDirectory(join(projectRoot, sourceConfig.directory));
    for (const diskRelative of sourceDiskFiles) {
      await this.propagateOneAdded(
        diskRelative,
        sourceManifestMap,
        sourceConfig,
        targetConfig,
        fileResults,
        projectRoot,
        docsDir
      );
    }
  }

  private async propagateOneAdded(
    diskRelative: string,
    sourceManifestMap: Map<string, { value: string }>,
    sourceConfig: ToolConfig,
    targetConfig: ToolConfig,
    fileResults: SyncFileResult[],
    projectRoot: string,
    docsDir: string
  ): Promise<void> {
    const sourceRelativePath = `${sourceConfig.directory}${diskRelative}`;
    if (isSyncExcluded(sourceRelativePath, docsDir) || sourceManifestMap.has(sourceRelativePath))
      return;

    const sectionKey = sourceConfig.detectUserFileSectionKey(sourceRelativePath);
    if (sectionKey === null) return;

    const targetRelativePath = buildTargetPath(targetConfig, sectionKey);
    if (targetRelativePath === null) return;

    const diskSourceContent = await this.fs.readFile(join(projectRoot, sourceRelativePath));
    const targetContent = transformContent(
      diskSourceContent,
      sourceConfig,
      targetConfig,
      sectionKey,
      docsDir
    );

    const diskTargetPath = join(projectRoot, targetRelativePath);
    if (
      (await this.fs.fileExists(diskTargetPath)) &&
      (await this.fs.readFile(diskTargetPath)) === targetContent
    ) {
      fileResults.push({
        relativePath: targetRelativePath,
        conflict: false,
        skipped: true,
        written: false,
      });
      return;
    }

    await this.fs.writeFile(diskTargetPath, targetContent);
    fileResults.push({
      relativePath: targetRelativePath,
      conflict: false,
      skipped: false,
      written: true,
    });
  }

  private async propagateDeleted(ctx: {
    sourceManifestFiles: ReadonlyArray<{ relativePath: string; frameworkPath?: string }>;
    targetByFrameworkPath: Map<string, string>;
    fileResults: SyncFileResult[];
    projectRoot: string;
    docsDir: string;
  }): Promise<void> {
    const { sourceManifestFiles, targetByFrameworkPath, fileResults, projectRoot, docsDir } = ctx;
    for (const sourceManifestFile of sourceManifestFiles) {
      await this.propagateOneDeleted(
        sourceManifestFile,
        targetByFrameworkPath,
        fileResults,
        projectRoot,
        docsDir
      );
    }
  }

  private async propagateOneDeleted(
    sourceManifestFile: { relativePath: string; frameworkPath?: string },
    targetByFrameworkPath: Map<string, string>,
    fileResults: SyncFileResult[],
    projectRoot: string,
    docsDir: string
  ): Promise<void> {
    const { relativePath, frameworkPath } = sourceManifestFile;
    if (isSyncExcluded(relativePath, docsDir) || frameworkPath === undefined) return;
    if (await this.fs.fileExists(join(projectRoot, relativePath))) return;

    const targetRelativePath = targetByFrameworkPath.get(frameworkPath);
    if (targetRelativePath === undefined) return;

    const diskTargetPath = join(projectRoot, targetRelativePath);
    if (!(await this.fs.fileExists(diskTargetPath))) return;

    await this.fs.deleteFile(diskTargetPath);
    fileResults.push({
      relativePath: targetRelativePath,
      conflict: false,
      skipped: false,
      written: false,
      deleted: true,
    });
  }
}
