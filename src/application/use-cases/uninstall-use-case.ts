import { dirname, join } from "node:path";
import { PluginNotFoundError } from "../../domain/errors.js";
import type { Manifest } from "../../domain/models/manifest.js";
import type { McpExclusion } from "../../domain/models/mcp-exclusion.js";
import {
  isMergeContentEmpty,
  type MergeFileEntry,
  removeEntriesFromJson,
} from "../../domain/models/merge.js";
import type { AiToolId } from "../../domain/models/tool-ids.js";
import { AI_TOOL_IDS } from "../../domain/models/tool-ids.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import {
  getToolConfig,
  isAiTool,
  type ToolId,
  VALID_TOOL_IDS,
} from "../../domain/tools/registry.js";
import { InputRequiredError, NoManifestError, ToolNotInstalledError } from "../errors.js";
import { CatalogUseCase } from "./shared/catalog-use-case.js";

interface UninstallOptions {
  toolIds: ToolId[];
  projectRoot: string;
  repo?: string;
  mcpFilter: string[];
  pluginName?: string;
}

interface UninstallToolResult {
  toolId: ToolId;
  fileCount: number;
  deletedFiles: string[];
}

export class UninstallUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly logger: Logger
  ) {}

  async execute(options: UninstallOptions): Promise<UninstallToolResult[]> {
    const { toolIds, projectRoot, repo, mcpFilter, pluginName } = options;

    if (pluginName !== undefined) {
      return this.executePluginUninstall(pluginName, toolIds, projectRoot, repo);
    }

    if (toolIds.length === 0) {
      throw new InputRequiredError(
        `At least one tool ID is required. Valid tools: ${VALID_TOOL_IDS.join(", ")}`
      );
    }

    const manifest = await this.loadAndValidate(toolIds, repo);

    const results =
      mcpFilter.length > 0
        ? await this.removeMcpFromTools(toolIds, manifest, projectRoot, mcpFilter)
        : await this.removeTools(toolIds, manifest, projectRoot);

    await this.manifestRepo.save(manifest);
    await new CatalogUseCase(this.fs).execute({ manifest, docsDir: manifest.docsDir, projectRoot });
    return results;
  }

  private async executePluginUninstall(
    pluginName: string,
    toolIds: ToolId[],
    projectRoot: string,
    repo?: string
  ): Promise<UninstallToolResult[]> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) throw new NoManifestError(repo);
    const scope = this.resolvePluginToolScope(toolIds, manifest);
    const results = await this.removePluginFromTools(pluginName, scope, projectRoot, manifest);
    if (results.length === 0) throw new PluginNotFoundError(pluginName);
    await this.manifestRepo.save(manifest);
    return results;
  }

  private resolvePluginToolScope(toolIds: ToolId[], manifest: Manifest): AiToolId[] {
    if (toolIds.length > 0) return toolIds.filter((id) => manifest.hasTool(id)) as AiToolId[];
    return AI_TOOL_IDS.filter((id) => manifest.hasTool(id)) as AiToolId[];
  }

  private async removePluginFromTools(
    pluginName: string,
    toolIds: AiToolId[],
    projectRoot: string,
    manifest: Manifest
  ): Promise<UninstallToolResult[]> {
    const results: UninstallToolResult[] = [];
    for (const toolId of toolIds) {
      const plugin = manifest.getPlugins(toolId).find((p) => p.name === pluginName);
      if (plugin === undefined) continue;
      const deletedFiles = await this.deletePluginFiles(plugin.files, projectRoot);
      manifest.removePlugin(toolId, pluginName);
      results.push({ toolId, fileCount: deletedFiles.length, deletedFiles });
    }
    return results;
  }

  private async deletePluginFiles(
    files: ReadonlyMap<string, string>,
    projectRoot: string
  ): Promise<string[]> {
    const deleted: string[] = [];
    for (const relativePath of files.keys()) {
      const fullPath = join(projectRoot, relativePath);
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
      deleted.push(relativePath);
    }
    return deleted;
  }

  private async loadAndValidate(toolIds: ToolId[], repo?: string): Promise<Manifest> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) throw new NoManifestError(repo);
    for (const toolId of toolIds) {
      if (!manifest.hasTool(toolId)) throw new ToolNotInstalledError(toolId);
    }
    return manifest;
  }

  private async removeTools(
    toolIds: ToolId[],
    manifest: Manifest,
    projectRoot: string
  ): Promise<UninstallToolResult[]> {
    const results: UninstallToolResult[] = [];
    for (const toolId of toolIds) {
      const result = await this.removeOneTool(toolId, toolIds, manifest, projectRoot);
      results.push(result);
    }
    return results;
  }

  private async removeOneTool(
    toolId: ToolId,
    allToolIds: ToolId[],
    manifest: Manifest,
    projectRoot: string
  ): Promise<UninstallToolResult> {
    this.logger.info(`Removing ${toolId} files...`);

    const sharedPaths = this.computeSharedPaths(toolId, allToolIds, manifest);
    const mergeFilePaths = this.collectMergeFilePaths(toolId, manifest);
    const allPaths = this.collectToolPaths(toolId, manifest);
    const deletedFiles: string[] = [];

    for (const relativePath of allPaths) {
      if (sharedPaths.has(relativePath) && !mergeFilePaths.has(relativePath)) continue;
      if (mergeFilePaths.has(relativePath)) {
        const removed = await this.removeMergeFile(
          toolId,
          allToolIds,
          relativePath,
          manifest,
          projectRoot
        );
        if (removed) deletedFiles.push(relativePath);
        continue;
      }
      const fullPath = join(projectRoot, relativePath);
      await this.fs.deleteFile(fullPath);
      deletedFiles.push(relativePath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
    }

    await this.removePluginFiles(toolId, manifest, projectRoot);
    manifest.removeTool(toolId);
    return { toolId, fileCount: deletedFiles.length, deletedFiles };
  }

  private async removePluginFiles(
    toolId: ToolId,
    manifest: Manifest,
    projectRoot: string
  ): Promise<void> {
    for (const plugin of manifest.getPlugins(toolId)) {
      await this.deletePluginFiles(plugin.files, projectRoot);
    }
  }

  private collectMergeFilePaths(toolId: ToolId, manifest: Manifest): Set<string> {
    return new Set(manifest.getMergeFiles(toolId).map((m) => m.relativePath));
  }

  private async removeMergeFile(
    toolId: ToolId,
    allToolIds: ToolId[],
    relativePath: string,
    manifest: Manifest,
    projectRoot: string
  ): Promise<boolean> {
    const mergeEntry = manifest.getMergeFiles(toolId).find((m) => m.relativePath === relativePath);
    if (!mergeEntry) return false;
    const fullPath = join(projectRoot, relativePath);
    if (!(await this.fs.fileExists(fullPath))) return false;
    const canDelete = this.computeDeletePermission(toolId, allToolIds, relativePath, manifest);
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
    relativePath: string,
    manifest: Manifest
  ): boolean {
    const otherOwnersExist = this.otherToolsOwnMergeFile(
      toolId,
      allToolIds,
      relativePath,
      manifest
    );
    const isIdeTool = !isAiTool(getToolConfig(toolId));
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
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
      return true;
    }
    const content = await this.fs.readFile(fullPath);
    const cleaned = removeEntriesFromJson(content, mergeEntry.sectionKey, keys);
    if (isMergeContentEmpty(cleaned, mergeEntry.sectionKey)) {
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
      return true;
    }
    if (canDelete) {
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
      return true;
    }
    await this.fs.writeFile(fullPath, cleaned);
    return false;
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

  private collectToolPaths(toolId: ToolId, manifest: Manifest): string[] {
    const filePaths = manifest.getToolFiles(toolId).map((f) => f.relativePath);
    const mergePaths = manifest.getMergeFiles(toolId).map((m) => m.relativePath);
    return [...filePaths, ...mergePaths];
  }

  private async removeMcpFromTools(
    toolIds: ToolId[],
    manifest: Manifest,
    projectRoot: string,
    mcpFilter: string[]
  ): Promise<UninstallToolResult[]> {
    const results: UninstallToolResult[] = [];
    for (const toolId of toolIds) {
      const result = await this.removeMcpFromTool(toolId, manifest, projectRoot, mcpFilter);
      results.push(result);
    }
    return results;
  }

  private async removeMcpFromTool(
    toolId: ToolId,
    manifest: Manifest,
    projectRoot: string,
    mcpFilter: string[]
  ): Promise<UninstallToolResult> {
    this.logger.info(`Removing MCP entries from ${toolId}...`);
    const mergeFiles = manifest.getMergeFiles(toolId);
    const removedKeys: string[] = [];
    const exclusions: McpExclusion[] = [];
    for (const mergeFile of mergeFiles) {
      const r = await this.processOneMergeFile(mergeFile, projectRoot, mcpFilter);
      removedKeys.push(...r.keys);
      exclusions.push(...r.exclusions);
    }
    this.rebuildMergeEntries(toolId, manifest, mcpFilter);
    manifest.addExcludedMcp(toolId, exclusions);
    return { toolId, fileCount: removedKeys.length, deletedFiles: removedKeys };
  }

  private async processOneMergeFile(
    mergeFile: MergeFileEntry,
    projectRoot: string,
    mcpFilter: string[]
  ): Promise<{ keys: string[]; exclusions: McpExclusion[] }> {
    if (mergeFile.sectionKey === null) return { keys: [], exclusions: [] };
    const matching = mcpFilter.filter((k) => mergeFile.entries[k] !== undefined);
    if (matching.length === 0) return { keys: [], exclusions: [] };
    await this.removeKeysFromJsonFile(
      join(projectRoot, mergeFile.relativePath),
      mergeFile.sectionKey,
      matching
    );
    const exclusions = matching.map((k) => ({ configPath: mergeFile.relativePath, entryKey: k }));
    return { keys: matching, exclusions };
  }

  private async removeKeysFromJsonFile(
    fullPath: string,
    sectionKey: string | null,
    keysToRemove: string[]
  ): Promise<void> {
    const content = await this.fs.readFile(fullPath);
    await this.fs.writeFile(fullPath, removeEntriesFromJson(content, sectionKey, keysToRemove));
  }

  private rebuildMergeEntries(toolId: ToolId, manifest: Manifest, removedKeys: string[]): void {
    const mergeFiles = manifest.getMergeFiles(toolId);
    const removedSet = new Set(removedKeys);
    const updated = mergeFiles.map((mf) => {
      const entries = { ...mf.entries };
      for (const key of removedSet) delete entries[key];
      return { ...mf, entries };
    });
    manifest.updateToolMergeFiles(toolId, updated);
  }
}
