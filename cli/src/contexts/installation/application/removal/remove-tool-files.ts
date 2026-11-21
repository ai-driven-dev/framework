import { dirname, join } from "node:path";
import {
  isMergeContentEmpty,
  type MergeFileEntry,
  removeEntriesFromJson,
} from "../../../../shared/domain/merge.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../domain/manifest.js";
import { deletePluginFilesForTool } from "../plugin/plugin-helpers.js";

/** One tool leaving a project, among the tools leaving with it. */
export interface ToolRemoval {
  readonly toolId: ToolId;
  readonly allToolIds: readonly ToolId[];
  readonly manifest: Manifest;
  readonly projectRoot: string;
}

/** What removing a tool deletes from a project: its files, its merged keys and its plugins'
 * files. What other tools still being installed own is left in place. */
export class RemoveToolFiles {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly logger: Logger,
    private readonly tools: ToolCatalog
  ) {}

  /** The paths deleted, relative to the project. */
  async remove(removal: ToolRemoval): Promise<string[]> {
    const { toolId, manifest, projectRoot } = removal;
    this.logger.info(`Removing ${toolId} files...`);
    const deletedFiles = await this.deleteToolFiles(removal);
    await this.removeAllPluginFiles(toolId, manifest, projectRoot);
    return deletedFiles;
  }

  private async deleteToolFiles(removal: ToolRemoval): Promise<string[]> {
    const { toolId, manifest, projectRoot } = removal;
    const sharedPaths = this.computeSharedPaths(removal);
    const mergeFilePaths = this.collectMergeFilePaths(toolId, manifest);
    const deleted: string[] = [];
    for (const relativePath of this.collectToolPaths(toolId, manifest)) {
      if (sharedPaths.has(relativePath) && !mergeFilePaths.has(relativePath)) continue;
      if (mergeFilePaths.has(relativePath)) {
        if (await this.removeMergeFile(removal, relativePath)) deleted.push(relativePath);
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
    manifest: Manifest,
    projectRoot: string
  ): Promise<void> {
    if (!this.tools.isAiTool(toolId)) return;
    for (const plugin of manifest.getPlugins(toolId)) {
      await deletePluginFilesForTool(
        {
          files: plugin.files,
          scope: plugin.scope,
          tool: this.tools.aiProfile(toolId),
          projectRoot,
        },
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

  private async removeMergeFile(removal: ToolRemoval, relativePath: string): Promise<boolean> {
    const { toolId, manifest, projectRoot } = removal;
    const mergeEntry = manifest.getMergeFiles(toolId).find((m) => m.relativePath === relativePath);
    if (!mergeEntry) return false;
    const fullPath = join(projectRoot, relativePath);
    if (!(await this.fs.fileExists(fullPath))) return false;
    const canDelete = this.computeDeletePermission(removal, relativePath);
    if (mergeEntry.sectionKey === null && canDelete) {
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
      return true;
    }
    return this.deleteOrWriteStripped(fullPath, mergeEntry, canDelete);
  }

  private computeDeletePermission(removal: ToolRemoval, relativePath: string): boolean {
    const otherOwnersExist = this.otherToolsOwnMergeFile(removal, relativePath);
    const isIdeTool = !this.tools.isAiTool(removal.toolId);
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

  private otherToolsOwnMergeFile(removal: ToolRemoval, relativePath: string): boolean {
    const { toolId, allToolIds, manifest } = removal;
    const uninstallingSet = new Set([toolId, ...allToolIds]);
    return manifest
      .getInstalledToolIds()
      .filter((id) => !uninstallingSet.has(id))
      .some((id) => manifest.getMergeFiles(id).some((m) => m.relativePath === relativePath));
  }

  private computeSharedPaths(removal: ToolRemoval): Set<string> {
    const { toolId, allToolIds, manifest } = removal;
    const remainingToolIds = manifest
      .getInstalledToolIds()
      .filter((id) => id !== toolId && !allToolIds.includes(id));
    return new Set([
      ...remainingToolIds.flatMap((id) => manifest.getToolFiles(id).map((f) => f.relativePath)),
      ...remainingToolIds.flatMap((id) => manifest.getMergeFiles(id).map((m) => m.relativePath)),
    ]);
  }
}
