import { dirname, join } from "node:path";
import type { Manifest } from "../../domain/models/manifest.js";
import type { McpExclusion } from "../../domain/models/mcp-exclusion.js";
import { removeEntriesFromJson } from "../../domain/models/merge-entry.js";
import { type ToolId, VALID_TOOL_IDS } from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import { InputRequiredError, NoManifestError, ToolNotInstalledError } from "../errors.js";
import { CatalogUseCase } from "./catalog-use-case.js";

interface UninstallOptions {
  toolIds: ToolId[];
  projectRoot: string;
  repo?: string;
  mcpFilter?: string[];
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
    const { toolIds, projectRoot, repo, mcpFilter } = options;

    if (toolIds.length === 0) {
      throw new InputRequiredError(
        `At least one tool ID is required. Valid tools: ${VALID_TOOL_IDS.join(", ")}`
      );
    }

    const manifest = await this.loadAndValidate(toolIds, repo);

    const results =
      mcpFilter !== undefined && mcpFilter.length > 0
        ? await this.removeMcpFromTools(toolIds, manifest, projectRoot, mcpFilter)
        : await this.removeTools(toolIds, manifest, projectRoot);

    await this.manifestRepo.save(manifest);
    await new CatalogUseCase(this.fs).execute({ manifest, docsDir: manifest.docsDir, projectRoot });
    return results;
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
    const allPaths = this.collectToolPaths(toolId, manifest);
    const deletedFiles: string[] = [];

    for (const relativePath of allPaths) {
      if (sharedPaths.has(relativePath)) continue;
      const fullPath = join(projectRoot, relativePath);
      await this.fs.deleteFile(fullPath);
      deletedFiles.push(relativePath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
    }

    manifest.removeTool(toolId);
    return { toolId, fileCount: deletedFiles.length, deletedFiles };
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
      if (mergeFile.sectionKey === null) continue;
      const matching = mcpFilter.filter((k) => mergeFile.entries[k] !== undefined);
      if (matching.length === 0) continue;
      await this.removeKeysFromJsonFile(
        join(projectRoot, mergeFile.relativePath),
        mergeFile.sectionKey,
        matching
      );
      for (const key of matching) {
        removedKeys.push(key);
        exclusions.push({ configPath: mergeFile.relativePath, entryKey: key });
      }
    }

    this.rebuildMergeEntries(toolId, manifest, mcpFilter);
    manifest.addExcludedMcp(toolId, exclusions);

    return { toolId, fileCount: removedKeys.length, deletedFiles: removedKeys };
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
