import { join } from "node:path";
import { parseFrontmatter, serializeFrontmatter } from "../../domain/models/frontmatter.js";
import {
  type SectionHandler,
  type ToolConfig,
  type ToolId,
  type UserFileSectionKey,
  getToolConfig,
} from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";

interface SyncOptions {
  projectRoot: string;
  docsDir: string;
  sourceTool: ToolId;
  targetTools?: ToolId[];
  force?: boolean;
  includeUserFiles?: boolean;
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

interface SyncResult {
  sourceTool: ToolId;
  tools: SyncToolResult[];
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
          canonicalFrontmatter
        );

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

function buildTargetPath(targetConfig: ToolConfig, sectionKey: UserFileSectionKey): string | null {
  return targetConfig[sectionKey.section]().buildFilePath(sectionKey.key);
}

export class SyncUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly hasher: Hasher,
    private readonly logger: Logger
  ) {}

  async execute(options: SyncOptions): Promise<SyncResult> {
    const { projectRoot, docsDir, sourceTool, force = false, includeUserFiles = false } = options;

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

    const sourceConfig = getToolConfig(sourceTool);
    const sourceManifestFiles = manifest.getToolFiles(sourceTool);
    const sourceManifestMap = new Map(sourceManifestFiles.map((f) => [f.relativePath, f.hash]));

    const toolResults: SyncToolResult[] = [];

    for (const targetToolId of targetTools) {
      this.logger.info(`Syncing ${sourceTool} → ${targetToolId}...`);

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

      toolResults.push({ targetToolId, files: fileResults });
    }

    return { sourceTool, tools: toolResults };
  }

  private async propagateModified(ctx: {
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
  }): Promise<void> {
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
      const { relativePath, hash: manifestHash, frameworkPath } = sourceManifestFile;

      if (isExcluded(relativePath, docsDir)) continue;
      if (frameworkPath === undefined) continue;

      const diskSourcePath = join(projectRoot, relativePath);
      if (!(await this.fs.fileExists(diskSourcePath))) continue;

      const diskSourceHash = await this.fs.readFileHash(diskSourcePath);
      if (diskSourceHash.value === manifestHash.value) continue;

      const sectionKey = getSectionKeyFromFrameworkPath(frameworkPath);
      if (sectionKey === null) continue;

      const targetRelativePath = targetByFrameworkPath.get(frameworkPath);
      if (targetRelativePath === undefined) continue;

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
      const sourceRelativePath = `${sourceConfig.directory}${diskRelative}`;
      if (isExcluded(sourceRelativePath, docsDir)) continue;
      if (sourceManifestMap.has(sourceRelativePath)) continue;

      const sectionKey = sourceConfig.detectUserFileSectionKey(sourceRelativePath);
      if (sectionKey === null) continue;

      const targetRelativePath = buildTargetPath(targetConfig, sectionKey);
      if (targetRelativePath === null) continue;

      const diskSourceContent = await this.fs.readFile(join(projectRoot, sourceRelativePath));
      const targetContent = transformContent(
        diskSourceContent,
        sourceConfig,
        targetConfig,
        sectionKey,
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
    }
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
      const { relativePath, frameworkPath } = sourceManifestFile;
      if (isExcluded(relativePath, docsDir)) continue;
      if (frameworkPath === undefined) continue;

      if (await this.fs.fileExists(join(projectRoot, relativePath))) continue;

      const targetRelativePath = targetByFrameworkPath.get(frameworkPath);
      if (targetRelativePath === undefined) continue;

      const diskTargetPath = join(projectRoot, targetRelativePath);
      if (!(await this.fs.fileExists(diskTargetPath))) continue;

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
