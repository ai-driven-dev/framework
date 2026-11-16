import { dirname, join } from "node:path";
import { InputRequiredError, ToolNotInstalledError } from "../../../shared/domain/errors.js";
import {
  isMergeContentEmpty,
  type MergeFileEntry,
  removeEntriesFromJson,
} from "../../../shared/domain/merge.js";
import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { Logger } from "../../../shared/ports/logger.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { Manifest } from "../domain/manifest.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";
import { deletePluginFilesForTool } from "./plugin/plugin-helpers.js";
import { requireManifest } from "./shared/require-manifest.js";

export interface UninstallToolsCommand {
  toolIds: ToolId[];
  projectRoot: string;
  tools: ToolCatalog;
}

export interface UninstallToolsResult {
  toolId: ToolId;
  fileCount: number;
  deletedFiles: string[];
}

/** A user-scope plugin this project stops depending on once its tool is removed. */
export interface UserPluginRef {
  toolId: AiToolId;
  name: string;
}

/** Releases this project's claim on machine-wide plugins and native registrations, after the project is saved. */
export type DetachProjectClaims = (
  projectRoot: string,
  userPlugins: readonly UserPluginRef[],
  nativeRefs: ReadonlyMap<ToolId, readonly string[]>
) => Promise<void>;

/** Removes tools from a project: their files, merged keys and plugins, then their claims. */
export class UninstallTools {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly logger: Logger,
    private readonly manifestRepo: ManifestRepository,
    private readonly detachClaims: DetachProjectClaims
  ) {}

  async execute(command: UninstallToolsCommand): Promise<UninstallToolsResult[]> {
    const { toolIds, projectRoot, tools } = command;
    if (toolIds.length === 0) {
      throw new InputRequiredError(
        `At least one tool ID is required. Valid tools: ${tools.idsInCanonicalOrder().join(", ")}`
      );
    }
    const manifest = await this.loadAndValidate(toolIds);
    const userPlugins = toolIds.flatMap((toolId) =>
      tools.isAiTool(toolId)
        ? manifest
            .getPlugins(toolId)
            .filter((plugin) => plugin.scope === "user")
            .map((plugin) => ({ toolId, name: plugin.name }))
        : []
    );
    const nativeRefs = new Map<ToolId, readonly string[]>();
    for (const toolId of toolIds) {
      const refs = manifest.getNativeRegistrations(toolId)?.pluginRefs;
      if (refs !== undefined && refs.length > 0) nativeRefs.set(toolId, refs);
    }

    const results: UninstallToolsResult[] = [];
    for (const toolId of toolIds) {
      results.push(await this.removeOneTool(toolId, toolIds, tools, manifest, projectRoot));
    }

    await this.manifestRepo.save(manifest);
    await this.detachClaims(projectRoot, userPlugins, nativeRefs);
    return results;
  }

  private async loadAndValidate(toolIds: ToolId[]): Promise<Manifest> {
    const manifest = await requireManifest(this.manifestRepo);
    for (const toolId of toolIds) {
      if (!manifest.hasTool(toolId)) throw new ToolNotInstalledError(toolId);
    }
    return manifest;
  }

  private async removeOneTool(
    toolId: ToolId,
    allToolIds: ToolId[],
    tools: ToolCatalog,
    manifest: Manifest,
    projectRoot: string
  ): Promise<UninstallToolsResult> {
    this.logger.info(`Removing ${toolId} files...`);
    const sharedPaths = this.computeSharedPaths(toolId, allToolIds, manifest);
    const mergeFilePaths = this.collectMergeFilePaths(toolId, manifest);
    const allPaths = this.collectToolPaths(toolId, manifest);
    const deletedFiles = await this.deleteToolFiles(
      toolId,
      allToolIds,
      tools,
      allPaths,
      sharedPaths,
      mergeFilePaths,
      manifest,
      projectRoot
    );
    await this.removeAllPluginFiles(toolId, tools, manifest, projectRoot);
    manifest.removeTool(toolId);
    return { toolId, fileCount: deletedFiles.length, deletedFiles };
  }

  private async deleteToolFiles(
    toolId: ToolId,
    allToolIds: ToolId[],
    tools: ToolCatalog,
    allPaths: string[],
    sharedPaths: Set<string>,
    mergeFilePaths: Set<string>,
    manifest: Manifest,
    projectRoot: string
  ): Promise<string[]> {
    const deleted: string[] = [];
    for (const relativePath of allPaths) {
      if (sharedPaths.has(relativePath) && !mergeFilePaths.has(relativePath)) continue;
      if (mergeFilePaths.has(relativePath)) {
        const removed = await this.removeMergeFile(
          toolId,
          allToolIds,
          tools,
          relativePath,
          manifest,
          projectRoot
        );
        if (removed) deleted.push(relativePath);
        continue;
      }
      const fullPath = join(projectRoot, relativePath);
      await this.fs.deleteFile(fullPath);
      deleted.push(relativePath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
    }
    return deleted;
  }

  private async removeAllPluginFiles(
    toolId: ToolId,
    tools: ToolCatalog,
    manifest: Manifest,
    projectRoot: string
  ): Promise<void> {
    if (!tools.isAiTool(toolId)) return;
    for (const plugin of manifest.getPlugins(toolId)) {
      await deletePluginFilesForTool(
        plugin.files,
        plugin.scope,
        tools.aiProfile(toolId),
        projectRoot,
        this.fs
      );
    }
  }

  private collectMergeFilePaths(toolId: ToolId, manifest: Manifest): Set<string> {
    return new Set(manifest.getMergeFiles(toolId).map((m) => m.relativePath));
  }

  private collectToolPaths(toolId: ToolId, manifest: Manifest): string[] {
    const filePaths = manifest.getToolFiles(toolId).map((f) => f.relativePath);
    const mergePaths = manifest.getMergeFiles(toolId).map((m) => m.relativePath);
    return [...filePaths, ...mergePaths];
  }

  private async removeMergeFile(
    toolId: ToolId,
    allToolIds: ToolId[],
    tools: ToolCatalog,
    relativePath: string,
    manifest: Manifest,
    projectRoot: string
  ): Promise<boolean> {
    const mergeEntry = manifest.getMergeFiles(toolId).find((m) => m.relativePath === relativePath);
    if (!mergeEntry) return false;
    const fullPath = join(projectRoot, relativePath);
    if (!(await this.fs.fileExists(fullPath))) return false;
    const canDelete = this.computeDeletePermission(
      toolId,
      allToolIds,
      tools,
      relativePath,
      manifest
    );
    if (mergeEntry.sectionKey === null && canDelete) {
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
      return true;
    }
    return this.deleteOrWriteStripped(fullPath, mergeEntry, canDelete);
  }

  private computeDeletePermission(
    toolId: ToolId,
    allToolIds: ToolId[],
    tools: ToolCatalog,
    relativePath: string,
    manifest: Manifest
  ): boolean {
    const otherOwnersExist = this.otherToolsOwnMergeFile(
      toolId,
      allToolIds,
      relativePath,
      manifest
    );
    const isIdeTool = !tools.isAiTool(toolId);
    return !otherOwnersExist && !isIdeTool;
  }

  private async deleteOrWriteStripped(
    fullPath: string,
    mergeEntry: MergeFileEntry,
    canDelete: boolean
  ): Promise<boolean> {
    const keys = Object.keys(mergeEntry.entries);
    if (keys.length === 0) {
      if (!canDelete) return false;
      await this.deleteFileAndDir(fullPath);
      return true;
    }
    const content = await this.fs.readFile(fullPath);
    const cleaned = removeEntriesFromJson(content, mergeEntry.sectionKey, keys);
    if (isMergeContentEmpty(cleaned, mergeEntry.sectionKey) || canDelete) {
      await this.deleteFileAndDir(fullPath);
      return true;
    }
    await this.fs.writeFile(fullPath, cleaned);
    return false;
  }

  private async deleteFileAndDir(fullPath: string): Promise<void> {
    await this.fs.deleteFile(fullPath);
    await this.fs.deleteEmptyDirectories(dirname(fullPath));
  }

  private otherToolsOwnMergeFile(
    toolId: ToolId,
    allToolIds: ToolId[],
    relativePath: string,
    manifest: Manifest
  ): boolean {
    const uninstallingSet = new Set([toolId, ...allToolIds]);
    return manifest
      .getInstalledToolIds()
      .filter((id) => !uninstallingSet.has(id))
      .some((id) => manifest.getMergeFiles(id).some((m) => m.relativePath === relativePath));
  }

  private computeSharedPaths(
    toolId: ToolId,
    allToolIds: ToolId[],
    manifest: Manifest
  ): Set<string> {
    const remainingToolIds = manifest
      .getInstalledToolIds()
      .filter((id) => id !== toolId && !allToolIds.includes(id));
    return new Set([
      ...remainingToolIds.flatMap((id) => manifest.getToolFiles(id).map((f) => f.relativePath)),
      ...remainingToolIds.flatMap((id) => manifest.getMergeFiles(id).map((m) => m.relativePath)),
    ]);
  }
}
