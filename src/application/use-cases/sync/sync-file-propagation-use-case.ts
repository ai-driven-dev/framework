import { homedir as nodeHomedir } from "node:os";
import { join } from "node:path";
import type { PluginsCapability } from "../../../domain/capabilities/plugins-capability.js";
import type { Plugin } from "../../../domain/models/plugin.js";
import { SyncPolicy } from "../../../domain/models/sync-policy.js";
import {
  buildReverseComponentMap,
  buildTargetPath,
  canonicalFrameworkKey,
  getSectionKeyFromFrameworkPath,
  transformContent,
} from "../../../domain/models/sync-transform.js";
import type { FileReader } from "../../../domain/ports/file-reader.js";
import type { FileWriter } from "../../../domain/ports/file-writer.js";
import type { Logger } from "../../../domain/ports/logger.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import type { AiTool } from "../../../domain/tools/contracts.js";
import type { ToolId } from "../../../domain/tools/registry.js";
import { getToolConfig, isAiTool } from "../../../domain/tools/registry.js";
import type { SyncConflictResolverUseCase } from "./sync-conflict-resolver-use-case.js";

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

interface PropagationContext {
  sourceManifestFiles: ReadonlyArray<{
    relativePath: string;
    hash: { value: string };
    frameworkPath?: string;
  }>;
  sourceConfig: AiTool<unknown>;
  targetConfig: AiTool<unknown>;
  targetManifestMap: Map<string, { value: string }>;
  targetByFrameworkPath: Map<string, string>;
  fileResults: SyncFileResult[];
  projectRoot: string;
  docsDir: string;
  force: boolean;
}

type ManifestShape = Awaited<ReturnType<ManifestRepository["load"]>> & object;

export class SyncFilePropagationUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly conflictResolver: SyncConflictResolverUseCase,
    private readonly logger: Logger
  ) {}

  async syncAllTargets(opts: {
    targetTools: ToolId[];
    sourceTool: ToolId;
    sourceConfig: AiTool<unknown>;
    sourceManifestFiles: ReadonlyArray<{
      relativePath: string;
      hash: { value: string };
      frameworkPath?: string;
    }>;
    sourceManifestMap: Map<string, { value: string }>;
    manifest: ManifestShape;
    projectRoot: string;
    docsDir: string;
    force: boolean;
    includeUserFiles: boolean;
  }): Promise<SyncToolResult[]> {
    const { targetTools, sourceTool } = opts;
    const results: SyncToolResult[] = [];
    for (const targetToolId of targetTools) {
      this.logger.info(`Syncing ${sourceTool} → ${targetToolId}...`);
      results.push(await this.syncOneTool({ ...opts, targetToolId }));
    }
    return results;
  }

  private async syncOneTool(opts: {
    targetToolId: ToolId;
    sourceConfig: AiTool<unknown>;
    sourceManifestFiles: ReadonlyArray<{
      relativePath: string;
      hash: { value: string };
      frameworkPath?: string;
    }>;
    sourceManifestMap: Map<string, { value: string }>;
    manifest: ManifestShape;
    projectRoot: string;
    docsDir: string;
    force: boolean;
    includeUserFiles: boolean;
  }): Promise<SyncToolResult> {
    const {
      targetToolId,
      sourceConfig,
      sourceManifestFiles,
      sourceManifestMap,
      manifest,
      projectRoot,
      docsDir,
      force,
      includeUserFiles,
    } = opts;
    const targetConfigRaw = getToolConfig(targetToolId);
    if (!isAiTool(targetConfigRaw)) return { targetToolId, files: [] };

    const targetConfig = targetConfigRaw;
    const targetManifestFiles = manifest.getToolFiles(targetToolId);
    const targetManifestMap = new Map(targetManifestFiles.map((f) => [f.relativePath, f.hash]));
    const targetByFrameworkPath = new Map(
      targetManifestFiles
        .filter((f): f is typeof f & { frameworkPath: string } => f.frameworkPath !== undefined)
        .map((f) => [canonicalFrameworkKey(f.frameworkPath), f.relativePath])
    );
    const fileResults: SyncFileResult[] = [];
    const ctx: PropagationContext = {
      sourceManifestFiles,
      sourceConfig,
      targetConfig,
      targetManifestMap,
      targetByFrameworkPath,
      fileResults,
      projectRoot,
      docsDir,
      force,
    };

    await this.propagateModified(ctx);
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
    await this.propagatePluginsModified(
      sourceConfig,
      targetConfig,
      manifest,
      fileResults,
      projectRoot,
      docsDir,
      force
    );
    await this.propagatePluginsDeleted(
      sourceConfig,
      targetConfig,
      manifest,
      fileResults,
      projectRoot
    );

    return { targetToolId, files: fileResults };
  }

  private async propagateModified(ctx: PropagationContext): Promise<void> {
    for (const sourceFile of ctx.sourceManifestFiles) {
      await this.propagateOneModified(sourceFile, ctx);
    }
  }

  private async propagateOneModified(
    sourceFile: { relativePath: string; hash: { value: string }; frameworkPath?: string },
    ctx: PropagationContext
  ): Promise<void> {
    const { relativePath, hash: manifestHash, frameworkPath } = sourceFile;
    const {
      sourceConfig,
      targetConfig,
      targetManifestMap,
      targetByFrameworkPath,
      fileResults,
      projectRoot,
      docsDir,
      force,
    } = ctx;
    if (new SyncPolicy(docsDir).isProtected(relativePath) || frameworkPath === undefined) return;

    const diskSourcePath = join(projectRoot, relativePath);
    if (!(await this.fs.fileExists(diskSourcePath))) return;
    const diskSourceHash = await this.fs.readFileHash(diskSourcePath);
    if (diskSourceHash.value === manifestHash.value) return;

    const sectionKey = getSectionKeyFromFrameworkPath(frameworkPath);
    const targetRelativePath = targetByFrameworkPath.get(canonicalFrameworkKey(frameworkPath));
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

    const { outcome, conflict } = await this.conflictResolver.resolveWriteOutcome({
      diskTargetPath,
      diskTargetExists,
      targetRelativePath,
      targetManifestMap,
      targetContent,
      force,
    });
    await this.applyOutcome(
      outcome,
      diskTargetPath,
      targetContent,
      targetRelativePath,
      fileResults,
      conflict
    );
  }

  private async propagateAdded(opts: {
    sourceManifestMap: Map<string, { value: string }>;
    sourceConfig: AiTool<unknown>;
    targetConfig: AiTool<unknown>;
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
    } = opts;
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
    sourceConfig: AiTool<unknown>,
    targetConfig: AiTool<unknown>,
    fileResults: SyncFileResult[],
    projectRoot: string,
    docsDir: string
  ): Promise<void> {
    const sourceRelativePath = `${sourceConfig.directory}${diskRelative}`;
    if (
      new SyncPolicy(docsDir).isProtected(sourceRelativePath) ||
      sourceManifestMap.has(sourceRelativePath)
    )
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
    const exists = await this.fs.fileExists(diskTargetPath);

    if (exists && (await this.fs.readFile(diskTargetPath)) === targetContent) {
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

  private async propagateDeleted(opts: {
    sourceManifestFiles: ReadonlyArray<{ relativePath: string; frameworkPath?: string }>;
    targetByFrameworkPath: Map<string, string>;
    fileResults: SyncFileResult[];
    projectRoot: string;
    docsDir: string;
  }): Promise<void> {
    for (const sourceFile of opts.sourceManifestFiles) {
      await this.propagateOneDeleted(
        sourceFile,
        opts.targetByFrameworkPath,
        opts.fileResults,
        opts.projectRoot,
        opts.docsDir
      );
    }
  }

  private async propagateOneDeleted(
    sourceFile: { relativePath: string; frameworkPath?: string },
    targetByFrameworkPath: Map<string, string>,
    fileResults: SyncFileResult[],
    projectRoot: string,
    docsDir: string
  ): Promise<void> {
    const { relativePath, frameworkPath } = sourceFile;
    if (new SyncPolicy(docsDir).isProtected(relativePath) || frameworkPath === undefined) return;
    if (await this.fs.fileExists(join(projectRoot, relativePath))) return;

    const targetRelativePath = targetByFrameworkPath.get(canonicalFrameworkKey(frameworkPath));
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

  private async propagatePluginsModified(
    sourceConfig: AiTool<unknown>,
    targetConfig: AiTool<unknown>,
    manifest: ManifestShape,
    fileResults: SyncFileResult[],
    projectRoot: string,
    docsDir: string,
    force: boolean
  ): Promise<void> {
    const sourcePlugins = manifest.getPlugins(sourceConfig.toolId);
    const targetPlugins = manifest.getPlugins(targetConfig.toolId);
    for (const srcPlugin of sourcePlugins) {
      const tgtPlugin = targetPlugins.find((p) => p.name === srcPlugin.name);
      if (tgtPlugin === undefined) continue;
      await this.propagateOnePluginAllFiles(
        srcPlugin,
        tgtPlugin,
        sourceConfig,
        targetConfig,
        fileResults,
        projectRoot,
        docsDir,
        force
      );
    }
  }

  private async propagateOnePluginAllFiles(
    srcPlugin: Plugin,
    tgtPlugin: Plugin,
    sourceConfig: AiTool<unknown>,
    targetConfig: AiTool<unknown>,
    fileResults: SyncFileResult[],
    projectRoot: string,
    docsDir: string,
    force: boolean
  ): Promise<void> {
    const targetByComponent = buildReverseComponentMap(tgtPlugin);
    for (const [srcRelPath, manifestHash] of srcPlugin.files) {
      await this.propagateOnePluginModified(
        srcRelPath,
        manifestHash,
        srcPlugin,
        targetByComponent,
        sourceConfig,
        targetConfig,
        fileResults,
        projectRoot,
        docsDir,
        force
      );
    }
  }

  private async propagateOnePluginModified(
    srcRelPath: string,
    manifestHash: string,
    srcPlugin: Plugin,
    targetByComponent: Map<string, string>,
    sourceConfig: AiTool<unknown>,
    targetConfig: AiTool<unknown>,
    fileResults: SyncFileResult[],
    projectRoot: string,
    docsDir: string,
    force: boolean
  ): Promise<void> {
    const componentPath = srcPlugin.componentPaths.get(srcRelPath);
    if (componentPath === undefined) return;
    const sectionKey = getSectionKeyFromFrameworkPath(componentPath);
    if (sectionKey === null) return;
    const tgtRelPath = targetByComponent.get(componentPath);
    if (tgtRelPath === undefined) return;

    const srcBaseDir = resolvePluginBaseDir(sourceConfig, projectRoot);
    const diskSrcPath = join(srcBaseDir, srcRelPath);
    if (!(await this.fs.fileExists(diskSrcPath))) return;
    const diskHash = await this.fs.readFileHash(diskSrcPath);
    if (diskHash.value === manifestHash) return;

    const srcContent = await this.fs.readFile(diskSrcPath);
    const tgtContent = transformContent(
      srcContent,
      sourceConfig,
      targetConfig,
      sectionKey,
      docsDir
    );
    const tgtBaseDir = resolvePluginBaseDir(targetConfig, projectRoot);
    const diskTgtPath = join(tgtBaseDir, tgtRelPath);

    const outcome = await this.conflictResolver.resolvePluginWriteOutcome({
      diskTargetPath: diskTgtPath,
      targetContent: tgtContent,
      force,
    });
    await this.applyOutcome(outcome, diskTgtPath, tgtContent, tgtRelPath, fileResults, false);
  }

  private async propagatePluginsDeleted(
    sourceConfig: AiTool<unknown>,
    targetConfig: AiTool<unknown>,
    manifest: ManifestShape,
    fileResults: SyncFileResult[],
    projectRoot: string
  ): Promise<void> {
    const sourcePlugins = manifest.getPlugins(sourceConfig.toolId);
    const targetPlugins = manifest.getPlugins(targetConfig.toolId);
    for (const srcPlugin of sourcePlugins) {
      const tgtPlugin = targetPlugins.find((p) => p.name === srcPlugin.name);
      if (tgtPlugin === undefined) continue;
      await this.propagatePluginDeletedFiles(
        srcPlugin,
        tgtPlugin,
        sourceConfig,
        targetConfig,
        fileResults,
        projectRoot
      );
    }
  }

  private async propagatePluginDeletedFiles(
    srcPlugin: Plugin,
    tgtPlugin: Plugin,
    sourceConfig: AiTool<unknown>,
    targetConfig: AiTool<unknown>,
    fileResults: SyncFileResult[],
    projectRoot: string
  ): Promise<void> {
    const targetByComponent = buildReverseComponentMap(tgtPlugin);
    const srcBaseDir = resolvePluginBaseDir(sourceConfig, projectRoot);
    const tgtBaseDir = resolvePluginBaseDir(targetConfig, projectRoot);
    for (const [srcRelPath] of srcPlugin.files) {
      if (await this.fs.fileExists(join(srcBaseDir, srcRelPath))) continue;
      const componentPath = srcPlugin.componentPaths.get(srcRelPath);
      if (componentPath === undefined) continue;
      const tgtRelPath = targetByComponent.get(componentPath);
      if (tgtRelPath === undefined) continue;
      const diskTgtPath = join(tgtBaseDir, tgtRelPath);
      if (!(await this.fs.fileExists(diskTgtPath))) continue;
      await this.fs.deleteFile(diskTgtPath);
      fileResults.push({
        relativePath: tgtRelPath,
        conflict: false,
        skipped: false,
        written: false,
        deleted: true,
      });
    }
  }

  private async applyOutcome(
    outcome: "skipped" | "conflict" | "write",
    diskTargetPath: string,
    targetContent: string,
    relativePath: string,
    fileResults: SyncFileResult[],
    conflictFlag: boolean
  ): Promise<void> {
    if (outcome === "skipped") {
      fileResults.push({ relativePath, conflict: false, skipped: true, written: false });
    } else if (outcome === "conflict") {
      fileResults.push({ relativePath, conflict: true, skipped: false, written: false });
    } else {
      await this.fs.writeFile(diskTargetPath, targetContent);
      fileResults.push({ relativePath, conflict: conflictFlag, skipped: false, written: true });
    }
  }
}

/**
 * Resolves the plugin install base directory for a tool.
 * Returns projectRoot for project-scope tools and the user-homedir-resolved path for user-scope tools.
 * Matches the base-dir resolution used by ModeBFlatMaterializationAdapter and StatusUseCase.
 */
function resolvePluginBaseDir(toolConfig: AiTool<unknown>, projectRoot: string): string {
  const caps = toolConfig.capabilities as Record<string, unknown>;
  const pluginsCap = caps.plugins as PluginsCapability | undefined;
  if (pluginsCap === undefined) return projectRoot;
  return pluginsCap.resolvePluginsBaseDir(projectRoot, nodeHomedir());
}
