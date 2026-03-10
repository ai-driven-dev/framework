import { join } from "node:path";
import { generateDistribution } from "../../domain/models/distribution.js";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import { type ToolId, getToolConfig } from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";

export interface SyncOptions {
  projectRoot: string;
  docsDir: string;
  frameworkPath: string;
  version: string;
  sourceTool: ToolId;
  targetTools?: ToolId[];
  force?: boolean;
}

export interface SyncFileResult {
  relativePath: string;
  conflict: boolean;
  skipped: boolean;
  written: boolean;
  deleted?: boolean;
}

export interface SyncToolResult {
  targetToolId: ToolId;
  files: SyncFileResult[];
}

export interface SyncResult {
  sourceTool: ToolId;
  tools: SyncToolResult[];
}

const EXCLUDED_FILES = new Set([
  "CLAUDE.md",
  "AGENTS.md",
  ".github/copilot-instructions.md",
  ".mcp.json",
  ".cursor/mcp.json",
  ".vscode/mcp.json",
]);

function isExcluded(relativePath: string, docsDir: string): boolean {
  if (EXCLUDED_FILES.has(relativePath)) return true;
  if (relativePath.startsWith(".vscode/")) return true;
  if (relativePath.startsWith(`${docsDir}/`)) return true;
  if (relativePath.startsWith(".aidd/")) return true;
  return false;
}

export class SyncUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly loader: FrameworkLoader,
    private readonly hasher: Hasher,
    private readonly logger: Logger
  ) {}

  async execute(options: SyncOptions): Promise<SyncResult> {
    const { projectRoot, docsDir, frameworkPath, version, sourceTool, force = false } = options;

    const manifest = await this.manifestRepo.load();
    if (manifest === null) {
      throw new Error("No AIDD installation found. Run `aidd init` first.");
    }

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

    const { descriptor, contentFiles } = await this.loader.loadFromDirectory(
      frameworkPath,
      version
    );

    const sourceConfig = getToolConfig(sourceTool);
    const sourceDistribution = generateDistribution(
      descriptor,
      sourceConfig,
      docsDir,
      contentFiles,
      this.hasher
    );
    const sourceManifestFiles = manifest.getToolFiles(sourceTool);
    const sourceManifestMap = new Map(sourceManifestFiles.map((f) => [f.relativePath, f.hash]));

    const toolResults: SyncToolResult[] = [];

    for (const targetToolId of targetTools) {
      this.logger.info(`Syncing ${sourceTool} → ${targetToolId}...`);

      const targetConfig = getToolConfig(targetToolId);
      const targetDistribution = generateDistribution(
        descriptor,
        targetConfig,
        docsDir,
        contentFiles,
        this.hasher
      );
      const targetDistByFrameworkPath = new Map(
        targetDistribution
          .filter((f): f is typeof f & { frameworkPath: string } => f.frameworkPath !== undefined)
          .map((f) => [f.frameworkPath, f])
      );

      const targetManifestFiles = manifest.getToolFiles(targetToolId);
      const targetManifestMap = new Map(targetManifestFiles.map((f) => [f.relativePath, f.hash]));

      const fileResults: SyncFileResult[] = [];
      const updatedTargetFiles = new Map(
        targetManifestFiles.map((f) => [
          f.relativePath,
          new GeneratedFile({ relativePath: f.relativePath, content: "", hash: f.hash }),
        ])
      );

      await this.propagateModified({
        sourceDistribution,
        sourceManifestMap,
        sourceConfig,
        targetConfig,
        targetDistByFrameworkPath,
        targetManifestMap,
        updatedTargetFiles,
        fileResults,
        projectRoot,
        docsDir,
        force,
      });

      await this.propagateAdded({
        sourceDistribution,
        sourceManifestMap,
        sourceConfig,
        targetConfig,
        targetDistByFrameworkPath,
        updatedTargetFiles,
        fileResults,
        projectRoot,
        docsDir,
      });

      await this.propagateDeleted({
        sourceDistribution,
        sourceManifestFiles,
        targetDistByFrameworkPath,
        updatedTargetFiles,
        fileResults,
        projectRoot,
        docsDir,
      });

      if (fileResults.some((f) => f.written || f.deleted)) {
        manifest.addTool(targetToolId, manifest.getToolVersion(targetToolId) ?? version, [
          ...updatedTargetFiles.values(),
        ]);
      }

      toolResults.push({ targetToolId, files: fileResults });
    }

    await this.manifestRepo.save(manifest);

    return { sourceTool, tools: toolResults };
  }

  private async propagateModified(ctx: {
    sourceDistribution: ReturnType<typeof generateDistribution>;
    sourceManifestMap: Map<string, { value: string }>;
    sourceConfig: ReturnType<typeof getToolConfig>;
    targetConfig: ReturnType<typeof getToolConfig>;
    targetDistByFrameworkPath: Map<string, { relativePath: string }>;
    targetManifestMap: Map<string, { value: string }>;
    updatedTargetFiles: Map<string, GeneratedFile>;
    fileResults: SyncFileResult[];
    projectRoot: string;
    docsDir: string;
    force: boolean;
  }): Promise<void> {
    const {
      sourceDistribution,
      sourceManifestMap,
      sourceConfig,
      targetConfig,
      targetDistByFrameworkPath,
      targetManifestMap,
      updatedTargetFiles,
      fileResults,
      projectRoot,
      docsDir,
      force,
    } = ctx;

    for (const sourceFile of sourceDistribution) {
      if (isExcluded(sourceFile.relativePath, docsDir)) continue;

      const manifestHash = sourceManifestMap.get(sourceFile.relativePath);
      if (manifestHash === undefined) continue;

      const diskSourcePath = join(projectRoot, sourceFile.relativePath);
      const diskSourceExists = await this.fs.fileExists(diskSourcePath);
      if (!diskSourceExists) continue;

      const diskSourceHash = await this.fs.readFileHash(diskSourcePath);
      if (diskSourceHash.value === manifestHash.value) continue;

      if (sourceFile.frameworkPath === undefined) continue;

      const correspondingTarget = targetDistByFrameworkPath.get(sourceFile.frameworkPath);
      if (correspondingTarget === undefined) continue;

      const diskSourceContent = await this.fs.readFile(diskSourcePath);
      const canonicalContent = sourceConfig.reverseRewriteContent(diskSourceContent, docsDir);
      const targetContent = targetConfig.rewriteContent(canonicalContent, docsDir);

      const targetRelativePath = correspondingTarget.relativePath;
      const diskTargetPath = join(projectRoot, targetRelativePath);
      const diskTargetExists = await this.fs.fileExists(diskTargetPath);

      let conflict = false;
      if (diskTargetExists) {
        const diskTargetHash = await this.fs.readFileHash(diskTargetPath);
        const targetManifestHash = targetManifestMap.get(targetRelativePath);
        if (targetManifestHash !== undefined && diskTargetHash.value !== targetManifestHash.value) {
          conflict = true;
        }
      }

      if (diskTargetExists) {
        const currentTargetContent = await this.fs.readFile(diskTargetPath);
        if (currentTargetContent === targetContent) {
          fileResults.push({
            relativePath: targetRelativePath,
            conflict: false,
            skipped: true,
            written: false,
          });
          continue;
        }
      }

      if (conflict && !force) {
        fileResults.push({
          relativePath: targetRelativePath,
          conflict: true,
          skipped: false,
          written: false,
        });
        continue;
      }

      await this.fs.writeFile(diskTargetPath, targetContent);
      const newHash = await this.fs.readFileHash(diskTargetPath);
      updatedTargetFiles.set(
        targetRelativePath,
        new GeneratedFile({
          relativePath: targetRelativePath,
          content: targetContent,
          hash: newHash,
        })
      );
      fileResults.push({
        relativePath: targetRelativePath,
        conflict,
        skipped: false,
        written: true,
      });
    }
  }

  private async propagateAdded(ctx: {
    sourceDistribution: ReturnType<typeof generateDistribution>;
    sourceManifestMap: Map<string, { value: string }>;
    sourceConfig: ReturnType<typeof getToolConfig>;
    targetConfig: ReturnType<typeof getToolConfig>;
    targetDistByFrameworkPath: Map<string, { relativePath: string }>;
    updatedTargetFiles: Map<string, GeneratedFile>;
    fileResults: SyncFileResult[];
    projectRoot: string;
    docsDir: string;
  }): Promise<void> {
    const {
      sourceDistribution,
      sourceManifestMap,
      sourceConfig,
      targetConfig,
      targetDistByFrameworkPath,
      updatedTargetFiles,
      fileResults,
      projectRoot,
      docsDir,
    } = ctx;

    const sourceDistByPath = new Map(sourceDistribution.map((f) => [f.relativePath, f]));
    const sourceDirExists = await this.fs.fileExists(join(projectRoot, sourceConfig.directory));
    if (!sourceDirExists) return;

    const sourceDiskFiles = await this.fs.listDirectory(join(projectRoot, sourceConfig.directory));
    for (const diskRelative of sourceDiskFiles) {
      const sourceRelativePath = `${sourceConfig.directory}${diskRelative}`;
      if (isExcluded(sourceRelativePath, docsDir)) continue;
      if (sourceManifestMap.has(sourceRelativePath)) continue;

      const sourceDistFile = sourceDistByPath.get(sourceRelativePath);
      if (sourceDistFile?.frameworkPath === undefined) continue;

      const correspondingTarget = targetDistByFrameworkPath.get(sourceDistFile.frameworkPath);
      if (correspondingTarget === undefined) continue;

      const diskSourceContent = await this.fs.readFile(join(projectRoot, sourceRelativePath));
      const canonicalContent = sourceConfig.reverseRewriteContent(diskSourceContent, docsDir);
      const targetContent = targetConfig.rewriteContent(canonicalContent, docsDir);

      const targetRelativePath = correspondingTarget.relativePath;
      const diskTargetPath = join(projectRoot, targetRelativePath);

      await this.fs.writeFile(diskTargetPath, targetContent);
      const newHash = await this.fs.readFileHash(diskTargetPath);
      updatedTargetFiles.set(
        targetRelativePath,
        new GeneratedFile({
          relativePath: targetRelativePath,
          content: targetContent,
          hash: newHash,
        })
      );
      fileResults.push({
        relativePath: targetRelativePath,
        conflict: false,
        skipped: false,
        written: true,
      });
    }
  }

  private async propagateDeleted(ctx: {
    sourceDistribution: ReturnType<typeof generateDistribution>;
    sourceManifestFiles: ReadonlyArray<{ relativePath: string; hash: { value: string } }>;
    targetDistByFrameworkPath: Map<string, { relativePath: string }>;
    updatedTargetFiles: Map<string, GeneratedFile>;
    fileResults: SyncFileResult[];
    projectRoot: string;
    docsDir: string;
  }): Promise<void> {
    const {
      sourceDistribution,
      sourceManifestFiles,
      targetDistByFrameworkPath,
      updatedTargetFiles,
      fileResults,
      projectRoot,
      docsDir,
    } = ctx;

    const sourceDistByPath = new Map(sourceDistribution.map((f) => [f.relativePath, f]));

    for (const sourceManifestFile of sourceManifestFiles) {
      if (isExcluded(sourceManifestFile.relativePath, docsDir)) continue;
      const diskSourceExists = await this.fs.fileExists(
        join(projectRoot, sourceManifestFile.relativePath)
      );
      if (diskSourceExists) continue;

      const sourceDistFile = sourceDistByPath.get(sourceManifestFile.relativePath);
      if (sourceDistFile?.frameworkPath === undefined) continue;

      const correspondingTarget = targetDistByFrameworkPath.get(sourceDistFile.frameworkPath);
      if (correspondingTarget === undefined) continue;

      const targetRelativePath = correspondingTarget.relativePath;
      const diskTargetPath = join(projectRoot, targetRelativePath);
      const diskTargetExists = await this.fs.fileExists(diskTargetPath);
      if (!diskTargetExists) continue;

      await this.fs.deleteFile(diskTargetPath);
      updatedTargetFiles.delete(targetRelativePath);
      fileResults.push({
        relativePath: targetRelativePath,
        conflict: false,
        skipped: false,
        written: false,
        deleted: true,
      });
    }
  }
}
