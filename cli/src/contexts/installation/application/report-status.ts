import { join } from "node:path";
import { ToolNotInstalledError } from "../../../shared/domain/errors.js";
import type { FileHash } from "../../../shared/domain/file.js";
import { extractMergeEntries, type MergeFileEntry } from "../../../shared/domain/merge.js";
import type { AiToolId, ToolCategory, ToolId } from "../../../shared/domain/tool.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { Hasher } from "../../../shared/ports/hasher.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { Manifest } from "../domain/manifest.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";
import type { ToolFootprint } from "../ports/tool-sections.js";
import type { DetectPluginDrift } from "./shared/detect-plugin-drift.js";
import { requireManifest } from "./shared/require-manifest.js";

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

interface PluginDriftEntry {
  toolId: AiToolId;
  pluginName: string;
  driftedFiles: string[];
  notInstalledOnMachine: boolean;
}

export interface ReportStatusResult {
  tools: ToolStatus[];
  pluginDrift: PluginDriftEntry[];
  inSync: boolean;
}

export interface ReportStatusCommand {
  projectRoot: string;
  filterToolId?: string;
  category?: ToolCategory;
  pluginName?: string;
  /** The project's manifest, when the caller already read it: the report reads none of its own. */
  manifest?: Manifest;
}

/**
 * Callers that only ask depend on this, not on the class that answers it, so a double is a real
 * implementation rather than a cast.
 */
export interface StatusQuery {
  execute(options: ReportStatusCommand): Promise<ReportStatusResult>;
}

export class ReportStatus implements StatusQuery {
  constructor(
    private readonly fs: FileReader,
    private readonly manifestRepo: ManifestRepository,
    private readonly hasher: Hasher,
    private readonly detectPluginDrift: DetectPluginDrift,
    private readonly tools: ToolCatalog
  ) {}

  async execute(options: ReportStatusCommand): Promise<ReportStatusResult> {
    const { projectRoot, filterToolId, category, pluginName } = options;
    const manifest = options.manifest ?? (await requireManifest(this.manifestRepo));
    if (filterToolId && !manifest.hasTool(filterToolId))
      throw new ToolNotInstalledError(filterToolId);

    const installedToolIds = this.resolveToolIds(filterToolId, category, manifest);
    const tools = await this.checkAllTools(installedToolIds, manifest, projectRoot);
    const pluginDrift = await this.checkAllPlugins(
      installedToolIds,
      manifest,
      projectRoot,
      pluginName
    );
    const inSync = tools.every((t) => t.drifted.length === 0) && pluginDrift.length === 0;
    return { tools, pluginDrift, inSync };
  }

  private resolveToolIds(
    filterToolId: string | undefined,
    category: ToolCategory | undefined,
    manifest: Manifest
  ): ToolId[] {
    if (filterToolId) return manifest.getInstalledToolIds().filter((id) => id === filterToolId);
    if (category) {
      const allowed: readonly string[] = this.tools.idsInCanonicalOrder(category);
      return manifest.getInstalledToolIds().filter((id) => allowed.includes(id));
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
      tools.push(await this.checkOneTool(this.tools.profile(toolId), manifest, projectRoot));
    }
    return tools;
  }

  private async checkOneTool(
    tool: ToolFootprint,
    manifest: Manifest,
    projectRoot: string
  ): Promise<ToolStatus> {
    const toolId = tool.toolId;
    const version = manifest.getToolVersion(toolId) ?? "unknown";
    const trackedFiles = manifest.getToolFiles(toolId);
    const mergeFiles = manifest.getMergeFiles(toolId);
    const drifted = await this.checkTrackedFiles(trackedFiles, projectRoot);
    drifted.push(...(await this.checkMergeFiles(mergeFiles, projectRoot)));
    const dir = tool.directory;
    const trackedSet = manifest.getTrackedPathsInDirectory(dir);
    drifted.push(
      ...(await this.detectAddedFiles(dir, trackedSet, projectRoot, tool.machineLocalFiles()))
    );
    return { toolId, version, drifted };
  }

  private async detectAddedFiles(
    directory: string,
    trackedSet: Set<string>,
    projectRoot: string,
    // Written by this CLI on purpose and never tracked — reporting one as something the user added
    // would be a lie. The `.backup` skip below is not the same thing: nothing here writes such a
    // file, so it only spares one an older version left behind.
    machineLocal: readonly string[]
    // User-scope plugin dirs (e.g. ~/.cursor/plugins/local/) are not scanned for added files;
    // only tracked-file drift is detected for user-scope plugins.
  ): Promise<FileDrift[]> {
    const toolDir = join(projectRoot, directory);
    if (!(await this.fs.fileExists(toolDir))) return [];
    const added: FileDrift[] = [];
    const diskFiles = await this.fs.listDirectory(toolDir);
    for (const diskRelPath of diskFiles) {
      if (diskRelPath.endsWith(".backup")) continue;
      const fullRelPath = `${directory}${diskRelPath}`;
      if (machineLocal.includes(fullRelPath)) continue;
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
    const drifts = await this.detectPluginDrift.execute({
      manifest,
      projectRoot,
      toolIds,
      pluginName,
    });
    return drifts.map((drift) => ({
      toolId: drift.toolId,
      pluginName: drift.pluginName,
      driftedFiles: drift.files.map((file) => file.relativePath),
      notInstalledOnMachine: drift.notInstalledOnMachine,
    }));
  }
}
