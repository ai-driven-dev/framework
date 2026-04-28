import { join } from "node:path";
import type { FileHash } from "../../domain/models/file.js";
import type { Manifest } from "../../domain/models/manifest.js";
import { extractMergeEntries, type MergeFileEntry } from "../../domain/models/merge.js";
import type { AiToolId } from "../../domain/models/tool-ids.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import {
  getToolConfig,
  type ToolCategory,
  type ToolId,
  toolIdsForCategory,
} from "../../domain/tools/registry.js";
import { NoManifestError, ToolNotInstalledError } from "../errors.js";

type FileStatusKind = "modified" | "deleted" | "added";

interface FileDrift {
  relativePath: string;
  status: FileStatusKind;
}

interface ToolStatus {
  toolId: ToolId;
  version: string;
  drifted: FileDrift[];
}

interface DocsStatus {
  version: string;
  drifted: FileDrift[];
}

interface PluginDriftEntry {
  toolId: AiToolId;
  pluginName: string;
  driftedFiles: string[];
}

interface StatusReport {
  tools: ToolStatus[];
  docs: DocsStatus | null;
  pluginDrift: PluginDriftEntry[];
  inSync: boolean;
}

interface StatusOptions {
  projectRoot: string;
  filterToolId?: ToolId;
  filterDocs?: boolean;
  category?: ToolCategory;
  repo?: string;
  pluginName?: string;
}

export class StatusUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    readonly _logger: Logger,
    private readonly hasher: Hasher
  ) {}

  async execute(options: StatusOptions): Promise<StatusReport> {
    const { projectRoot, filterToolId, filterDocs, category, repo, pluginName } = options;
    const manifest = await this.manifestRepo.load();
    if (manifest === null) throw new NoManifestError(repo);
    if (filterToolId && !manifest.hasTool(filterToolId))
      throw new ToolNotInstalledError(filterToolId);

    const installedToolIds = this.resolveToolIds(filterToolId, filterDocs, category, manifest);
    const showDocs = !category && !filterToolId;
    const tools = await this.checkAllTools(installedToolIds, manifest, projectRoot);
    const docs = await this.checkDocsSection(manifest, projectRoot, filterDocs, showDocs);
    const pluginDrift = await this.checkAllPlugins(
      installedToolIds,
      manifest,
      projectRoot,
      pluginName
    );
    const inSync =
      tools.every((t) => t.drifted.length === 0) &&
      (docs === null || docs.drifted.length === 0) &&
      pluginDrift.length === 0;
    return { tools, docs, pluginDrift, inSync };
  }

  private resolveToolIds(
    filterToolId: ToolId | undefined,
    filterDocs: boolean | undefined,
    category: ToolCategory | undefined,
    manifest: Manifest
  ): ToolId[] {
    if (filterDocs) return [];
    if (filterToolId) return [filterToolId];
    if (category) {
      const allowed = toolIdsForCategory(category);
      return manifest
        .getInstalledToolIds()
        .filter((id) => (allowed as readonly string[]).includes(id));
    }
    return manifest.getInstalledToolIds();
  }

  private async checkAllTools(
    toolIds: ToolId[],
    manifest: Manifest,
    projectRoot: string
  ): Promise<ToolStatus[]> {
    const tools: ToolStatus[] = [];
    for (const toolId of toolIds) {
      tools.push(await this.checkOneTool(toolId, manifest, projectRoot));
    }
    return tools;
  }

  private async checkOneTool(
    toolId: ToolId,
    manifest: Manifest,
    projectRoot: string
  ): Promise<ToolStatus> {
    const version = manifest.getToolVersion(toolId) ?? "unknown";
    const trackedFiles = manifest.getToolFiles(toolId);
    const mergeFiles = manifest.getMergeFiles(toolId);
    const drifted = await this.checkTrackedFiles(trackedFiles, projectRoot);
    drifted.push(...(await this.checkMergeFiles(mergeFiles, projectRoot)));
    const dir = getToolConfig(toolId).directory;
    const trackedSet = manifest.getTrackedPathsInDirectory(dir);
    drifted.push(...(await this.detectAddedFiles(dir, trackedSet, projectRoot)));
    return { toolId, version, drifted };
  }

  private async checkDocsSection(
    manifest: Manifest,
    projectRoot: string,
    filterDocs: boolean | undefined,
    showDocs: boolean
  ): Promise<DocsStatus | null> {
    if (!showDocs && !filterDocs) return null;
    if (!manifest.hasDocs()) return null;
    const docsVersion = manifest.getDocsVersion() ?? "unknown";
    const docsFiles = manifest.getDocsFiles();
    const drifted = await this.checkTrackedFiles(docsFiles, projectRoot);
    const catalogPath = join(projectRoot, manifest.docsDir, "CATALOG.md");
    if (!(await this.fs.fileExists(catalogPath))) {
      drifted.push({ relativePath: `${manifest.docsDir}/CATALOG.md`, status: "deleted" });
    }
    const trackedDocsSet = new Set(docsFiles.map((f) => f.relativePath));
    drifted.push(...(await this.detectAddedDocs(manifest.docsDir, trackedDocsSet, projectRoot)));
    return { version: docsVersion, drifted };
  }

  private async detectAddedFiles(
    directory: string,
    trackedSet: Set<string>,
    projectRoot: string
  ): Promise<FileDrift[]> {
    const toolDir = join(projectRoot, directory);
    if (!(await this.fs.fileExists(toolDir))) return [];
    const added: FileDrift[] = [];
    const diskFiles = await this.fs.listDirectory(toolDir);
    for (const diskRelPath of diskFiles) {
      if (diskRelPath.endsWith(".backup")) continue;
      const fullRelPath = `${directory}${diskRelPath}`;
      if (!trackedSet.has(fullRelPath)) added.push({ relativePath: fullRelPath, status: "added" });
    }
    return added;
  }

  private async detectAddedDocs(
    docsDir: string,
    trackedSet: Set<string>,
    projectRoot: string
  ): Promise<FileDrift[]> {
    const dir = join(projectRoot, docsDir);
    if (!(await this.fs.fileExists(dir))) return [];
    const added: FileDrift[] = [];
    const diskFiles = await this.fs.listDirectory(dir);
    for (const diskRelPath of diskFiles) {
      if (diskRelPath.endsWith(".backup") || diskRelPath === "CATALOG.md") continue;
      const fullRelPath = `${docsDir}/${diskRelPath}`;
      if (!trackedSet.has(fullRelPath)) added.push({ relativePath: fullRelPath, status: "added" });
    }
    return added;
  }

  private async checkMergeFiles(
    mergeFiles: readonly MergeFileEntry[],
    projectRoot: string
  ): Promise<FileDrift[]> {
    const drifted: FileDrift[] = [];
    for (const mergeFile of mergeFiles) {
      drifted.push(...(await this.checkOneMergeFile(mergeFile, projectRoot)));
    }
    return drifted;
  }

  private async checkOneMergeFile(
    mergeFile: MergeFileEntry,
    projectRoot: string
  ): Promise<FileDrift[]> {
    const fullPath = join(projectRoot, mergeFile.relativePath);
    if (!(await this.fs.fileExists(fullPath))) {
      return Object.keys(mergeFile.entries).map((key) => ({
        relativePath: `${mergeFile.relativePath} > ${key}`,
        status: "deleted" as const,
      }));
    }
    const diskContent = await this.fs.readFile(fullPath);
    const diskEntries = extractMergeEntries(diskContent, mergeFile.sectionKey, this.hasher);
    return this.compareMergeEntries(mergeFile, diskEntries);
  }

  private compareMergeEntries(
    mergeFile: MergeFileEntry,
    diskEntries: Record<string, FileHash>
  ): FileDrift[] {
    const drifted: FileDrift[] = [];
    for (const [key, manifestHash] of Object.entries(mergeFile.entries)) {
      const diskHash = diskEntries[key];
      if (!diskHash) {
        drifted.push({ relativePath: `${mergeFile.relativePath} > ${key}`, status: "deleted" });
      } else if (!diskHash.equals(manifestHash)) {
        drifted.push({ relativePath: `${mergeFile.relativePath} > ${key}`, status: "modified" });
      }
    }
    return drifted;
  }

  private async checkTrackedFiles(
    files: ReadonlyArray<{ relativePath: string; hash: FileHash }>,
    projectRoot: string
  ): Promise<FileDrift[]> {
    const drifted: FileDrift[] = [];
    for (const file of files) {
      const fullPath = join(projectRoot, file.relativePath);
      if (!(await this.fs.fileExists(fullPath))) {
        drifted.push({ relativePath: file.relativePath, status: "deleted" });
      } else {
        const diskHash = await this.fs.readFileHash(fullPath);
        if (!diskHash.equals(file.hash)) {
          drifted.push({ relativePath: file.relativePath, status: "modified" });
        }
      }
    }
    return drifted;
  }

  private async checkAllPlugins(
    toolIds: ToolId[],
    manifest: Manifest,
    projectRoot: string,
    pluginName?: string
  ): Promise<PluginDriftEntry[]> {
    const result: PluginDriftEntry[] = [];
    for (const toolId of toolIds) {
      const entries = await this.checkPluginsForTool(
        toolId as AiToolId,
        manifest,
        projectRoot,
        pluginName
      );
      result.push(...entries);
    }
    return result;
  }

  private async checkPluginsForTool(
    toolId: AiToolId,
    manifest: Manifest,
    projectRoot: string,
    pluginName?: string
  ): Promise<PluginDriftEntry[]> {
    const plugins = manifest.getPlugins(toolId);
    const targets = pluginName ? plugins.filter((p) => p.name === pluginName) : plugins;
    const result: PluginDriftEntry[] = [];
    for (const plugin of targets) {
      const driftedFiles = await this.checkOnePluginDrift(plugin.files, projectRoot);
      if (driftedFiles.length > 0) {
        result.push({ toolId, pluginName: plugin.name, driftedFiles });
      }
    }
    return result;
  }

  private async checkOnePluginDrift(
    files: ReadonlyMap<string, string>,
    projectRoot: string
  ): Promise<string[]> {
    const drifted: string[] = [];
    for (const [relativePath, expectedHashValue] of files.entries()) {
      const fullPath = join(projectRoot, relativePath);
      if (!(await this.fs.fileExists(fullPath))) {
        drifted.push(relativePath);
      } else {
        const diskHash = await this.fs.readFileHash(fullPath);
        if (diskHash.value !== expectedHashValue) drifted.push(relativePath);
      }
    }
    return drifted;
  }
}
