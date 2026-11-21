import type { AiToolId, ToolCategory, ToolId } from "../../../shared/domain/tool.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import { ToolNotInstalledError } from "../domain/installation.error.js";
import type { Manifest } from "../domain/manifest.js";
import type { ManifestRepository } from "../ports/manifest-repository.js";
import type { ToolFootprint } from "../ports/tool-sections.js";
import type { DetectPluginDrift } from "./shared/detect-plugin-drift.js";
import { requireManifest } from "./shared/require-manifest.js";
import {
  addedFileDrift,
  type FileDrift,
  mergeFileDrift,
  trackedFileDrift,
} from "./status/tool-file-drift.js";

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

/** What ReportStatus is built from. */
export interface ReportStatusDeps {
  readonly fs: FileReader;
  readonly manifestRepo: ManifestRepository;
  readonly detectPluginDrift: DetectPluginDrift;
}

export class ReportStatus implements StatusQuery {
  constructor(
    private readonly deps: ReportStatusDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(options: ReportStatusCommand): Promise<ReportStatusResult> {
    const { projectRoot, filterToolId, category, pluginName } = options;
    const manifest = options.manifest ?? (await requireManifest(this.deps.manifestRepo));
    if (filterToolId && !manifest.hasTool(filterToolId))
      throw new ToolNotInstalledError(filterToolId);

    const installedToolIds = this.resolveToolIds(filterToolId, category, manifest);
    const tools = await this.checkAllTools(installedToolIds, manifest, projectRoot);
    const pluginDrift = await this.checkAllPlugins({
      toolIds: installedToolIds,
      manifest,
      projectRoot,
      pluginName,
    });
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
    const { fs } = this.deps;
    const drifted = [
      ...(await trackedFileDrift(fs, trackedFiles, projectRoot)),
      ...(await mergeFileDrift(fs, mergeFiles, projectRoot)),
      ...(await addedFileDrift(fs, {
        directory: tool.directory,
        trackedSet: manifest.getTrackedPathsInDirectory(tool.directory),
        projectRoot,
        machineLocal: tool.machineLocalFiles(),
      })),
    ];
    return { toolId, version, drifted };
  }

  private async checkAllPlugins(scope: {
    toolIds: ToolId[];
    manifest: Manifest;
    projectRoot: string;
    pluginName?: string;
  }): Promise<PluginDriftEntry[]> {
    const drifts = await this.deps.detectPluginDrift.execute(scope);
    return drifts.map((drift) => ({
      toolId: drift.toolId,
      pluginName: drift.pluginName,
      driftedFiles: drift.files.map((file) => file.relativePath),
      notInstalledOnMachine: drift.notInstalledOnMachine,
    }));
  }
}
