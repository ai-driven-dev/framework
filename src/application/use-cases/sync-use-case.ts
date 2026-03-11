import { join } from "node:path";
import { generateDistribution } from "../../domain/models/distribution.js";
import { parseFrontmatter, serializeFrontmatter } from "../../domain/models/frontmatter.js";
import {
  type UserFileSection,
  type ToolId,
  getToolConfig,
} from "../../domain/models/tool-config.js";
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
  includeUserFiles?: boolean;
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

function getSectionFromFrameworkPath(frameworkPath: string): UserFileSection | null {
  if (frameworkPath.startsWith("agents/")) return "agents";
  if (frameworkPath.startsWith("commands/")) return "commands";
  if (frameworkPath.startsWith("rules/")) return "rules";
  if (frameworkPath.startsWith("skills/")) return "skills";
  return null;
}

function transformContent(
  content: string,
  sourceConfig: ReturnType<typeof getToolConfig>,
  targetConfig: ReturnType<typeof getToolConfig>,
  section: UserFileSection | null,
  frameworkPath: string,
  docsDir: string
): string {
  if (section === null) {
    const canonical = sourceConfig.reverseRewriteContent(content, docsDir);
    return targetConfig.rewriteContent(canonical, docsDir);
  }

  const { frontmatter, body } = parseFrontmatter(content);

  const canonicalFrontmatter =
    sourceConfig[section]().reverseConvertFrontmatter(frontmatter);

  // relativeFileName is the path relative to the section directory (e.g. "04_code/implement.md")
  // needed by convertFrontmatter for commands to extract the phase prefix
  const sectionPrefix = `${section}/`;
  const relativeFileName = frameworkPath.startsWith(sectionPrefix)
    ? frameworkPath.slice(sectionPrefix.length)
    : frameworkPath;

  const targetFrontmatter =
    section === "commands"
      ? targetConfig.commands().convertFrontmatter(canonicalFrontmatter, relativeFileName)
      : (targetConfig[section]() as { convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> }).convertFrontmatter(canonicalFrontmatter);

  const canonicalBody = sourceConfig.reverseRewriteContent(body, docsDir);
  const targetBody = targetConfig.rewriteContent(canonicalBody, docsDir);

  return serializeFrontmatter(targetFrontmatter, targetBody);
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
    const {
      projectRoot,
      docsDir,
      frameworkPath,
      version,
      sourceTool,
      force = false,
      includeUserFiles = false,
    } = options;

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

      await this.propagateModified({
        sourceDistribution,
        sourceManifestMap,
        sourceConfig,
        targetConfig,
        targetDistByFrameworkPath,
        targetManifestMap,
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
        fileResults,
        projectRoot,
        docsDir,
        includeUserFiles,
      });

      await this.propagateDeleted({
        sourceDistribution,
        sourceManifestFiles,
        targetDistByFrameworkPath,
        fileResults,
        projectRoot,
        docsDir,
      });

      toolResults.push({ targetToolId, files: fileResults });
    }

    return { sourceTool, tools: toolResults };
  }

  private async propagateModified(ctx: {
    sourceDistribution: ReturnType<typeof generateDistribution>;
    sourceManifestMap: Map<string, { value: string }>;
    sourceConfig: ReturnType<typeof getToolConfig>;
    targetConfig: ReturnType<typeof getToolConfig>;
    targetDistByFrameworkPath: Map<string, { relativePath: string }>;
    targetManifestMap: Map<string, { value: string }>;
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
      const section = getSectionFromFrameworkPath(sourceFile.frameworkPath);
      const targetContent = transformContent(
        diskSourceContent,
        sourceConfig,
        targetConfig,
        section,
        sourceFile.frameworkPath,
        docsDir
      );

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
    fileResults: SyncFileResult[];
    projectRoot: string;
    docsDir: string;
    includeUserFiles: boolean;
  }): Promise<void> {
    const {
      sourceDistribution,
      sourceManifestMap,
      sourceConfig,
      targetConfig,
      targetDistByFrameworkPath,
      fileResults,
      projectRoot,
      docsDir,
      includeUserFiles,
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
      if (sourceDistFile?.frameworkPath === undefined) {
        if (!includeUserFiles) continue;

        const userKey = sourceConfig.detectUserFileSectionKey(sourceRelativePath);
        if (userKey === null) continue;

        const targetRelativePath = targetConfig[userKey.section]().buildFilePath(userKey.key);
        if (targetRelativePath === null) continue;

        const diskSourceContent = await this.fs.readFile(join(projectRoot, sourceRelativePath));
        const targetContent = transformContent(
          diskSourceContent,
          sourceConfig,
          targetConfig,
          userKey.section,
          userKey.key,
          docsDir
        );

        const diskTargetPath = join(projectRoot, targetRelativePath);
        const diskTargetExists = await this.fs.fileExists(diskTargetPath);
        if (diskTargetExists) {
          const current = await this.fs.readFile(diskTargetPath);
          if (current === targetContent) {
            fileResults.push({
              relativePath: targetRelativePath,
              conflict: false,
              skipped: true,
              written: false,
            });
            continue;
          }
        }

        await this.fs.writeFile(diskTargetPath, targetContent);
        fileResults.push({
          relativePath: targetRelativePath,
          conflict: false,
          skipped: false,
          written: true,
        });
        continue;
      }

      const correspondingTarget = targetDistByFrameworkPath.get(sourceDistFile.frameworkPath);
      if (correspondingTarget === undefined) continue;

      const diskSourceContent = await this.fs.readFile(join(projectRoot, sourceRelativePath));
      const addedSection = getSectionFromFrameworkPath(sourceDistFile.frameworkPath);
      const targetContent = transformContent(
        diskSourceContent,
        sourceConfig,
        targetConfig,
        addedSection,
        sourceDistFile.frameworkPath,
        docsDir
      );

      const targetRelativePath = correspondingTarget.relativePath;
      const diskTargetPath = join(projectRoot, targetRelativePath);

      await this.fs.writeFile(diskTargetPath, targetContent);
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
    fileResults: SyncFileResult[];
    projectRoot: string;
    docsDir: string;
  }): Promise<void> {
    const {
      sourceDistribution,
      sourceManifestFiles,
      targetDistByFrameworkPath,
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
