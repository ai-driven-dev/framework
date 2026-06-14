import { join } from "node:path";
import { PluginNotFoundError } from "../../../domain/errors.js";
import { DOCS_DIR } from "../../../domain/models/paths.js";
import { AI_TOOL_IDS, type AiToolId, isAiToolId } from "../../../domain/models/tool-ids.js";
import type { FileReader } from "../../../domain/ports/file-reader.js";
import type { FileWriter } from "../../../domain/ports/file-writer.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import type { AiTool } from "../../../domain/tools/contracts.js";
import { getToolConfig, isAiTool, type ToolId } from "../../../domain/tools/registry.js";
import { InputRequiredError, NoManifestError } from "../../errors.js";
import type {
  SyncFilePropagationUseCase,
  SyncFileResult,
  SyncToolResult,
} from "./sync-file-propagation-use-case.js";
import type { SyncPluginsUseCase } from "./sync-plugins-use-case.js";
import type { SyncSourceResolverUseCase } from "./sync-source-resolver-use-case.js";

export interface SyncOptions {
  projectRoot: string;
  docsDir?: string;
  sourceTool?: ToolId;
  targetTools?: ToolId[];
  force?: boolean;
  includeUserFiles?: boolean;
  interactive?: boolean;
  pluginName?: string;
  includePlugins?: boolean;
}

export interface SyncResult {
  sourceTool: ToolId;
  tools: SyncToolResult[];
  totalWritten: number;
  totalDeleted: number;
  totalConflicts: number;
  totalSkipped: number;
}

type ManifestShape = Awaited<ReturnType<ManifestRepository["load"]>> & object;

export class SyncUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly manifestRepo: ManifestRepository,
    private readonly hasher: Hasher,
    private readonly sourceResolver: SyncSourceResolverUseCase,
    private readonly filePropagation: SyncFilePropagationUseCase,
    private readonly syncPluginsUseCase?: SyncPluginsUseCase
  ) {}

  async execute(options: SyncOptions): Promise<SyncResult> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) throw new NoManifestError();

    if (options.pluginName !== undefined) {
      return this.executePluginSync(options.pluginName, options.projectRoot, manifest);
    }

    return this.executeToolSync(options, manifest);
  }

  private async executeToolSync(
    options: SyncOptions,
    manifest: ManifestShape
  ): Promise<SyncResult> {
    const { sourceTool, targetTools } = await this.sourceResolver.execute(manifest, {
      projectRoot: options.projectRoot,
      sourceTool: options.sourceTool,
      targetTools: options.targetTools,
      interactive: options.interactive,
    });
    const sourceConfigRaw = getToolConfig(sourceTool);
    if (!isAiTool(sourceConfigRaw))
      throw new InputRequiredError(`Source tool '${sourceTool}' does not support sync.`);
    const toolResults = await this.propagateToTargets(
      options,
      manifest,
      sourceTool,
      targetTools,
      sourceConfigRaw
    );
    await this.maybeSyncPlugins(options, sourceTool, targetTools);
    return this.buildSyncTotals(sourceTool, toolResults);
  }

  private async propagateToTargets(
    options: SyncOptions,
    manifest: ManifestShape,
    sourceTool: ToolId,
    targetTools: ToolId[],
    sourceConfigRaw: AiTool<unknown>
  ): Promise<
    ReturnType<SyncFilePropagationUseCase["syncAllTargets"]> extends Promise<infer R> ? R : never
  > {
    const docsDir = options.docsDir ?? DOCS_DIR;
    const sourceManifestFiles = manifest.getToolFiles(sourceTool);
    const sourceManifestMap = new Map(sourceManifestFiles.map((f) => [f.relativePath, f.hash]));
    return this.filePropagation.syncAllTargets({
      targetTools,
      sourceTool,
      sourceConfig: sourceConfigRaw,
      sourceManifestFiles,
      sourceManifestMap,
      manifest,
      projectRoot: options.projectRoot,
      docsDir,
      force: options.force ?? false,
      includeUserFiles: options.includeUserFiles ?? false,
    });
  }

  private async maybeSyncPlugins(
    options: SyncOptions,
    sourceTool: ToolId,
    targetTools: ToolId[]
  ): Promise<void> {
    if (options.includePlugins === false || this.syncPluginsUseCase === undefined) return;
    const aiSourceId = AI_TOOL_IDS.find((id) => id === sourceTool);
    if (aiSourceId === undefined) return;
    const aiTargetIds = targetTools.filter(isAiToolId);
    if (aiTargetIds.length === 0) return;
    await this.syncPluginsUseCase.execute({
      projectRoot: options.projectRoot,
      sourceToolId: aiSourceId,
      targetToolIds: aiTargetIds,
      force: options.force ?? false,
      interactive: options.interactive,
    });
  }

  private async executePluginSync(
    pluginName: string,
    projectRoot: string,
    manifest: ManifestShape
  ): Promise<SyncResult> {
    const toolIds = AI_TOOL_IDS.filter((id) => manifest.hasTool(id)) as AiToolId[];
    let firstMatchedTool: ToolId | undefined;
    for (const toolId of toolIds) {
      const found = await this.syncPluginHashesForTool(toolId, pluginName, projectRoot, manifest);
      if (found && firstMatchedTool === undefined) firstMatchedTool = toolId;
    }
    if (firstMatchedTool === undefined) throw new PluginNotFoundError(pluginName);
    await this.manifestRepo.save(manifest);
    return {
      sourceTool: firstMatchedTool,
      tools: [],
      totalWritten: 0,
      totalDeleted: 0,
      totalConflicts: 0,
      totalSkipped: 0,
    };
  }

  private async syncPluginHashesForTool(
    toolId: AiToolId,
    pluginName: string,
    projectRoot: string,
    manifest: ManifestShape
  ): Promise<boolean> {
    const plugin = manifest.getPlugins(toolId).find((p) => p.name === pluginName);
    if (plugin === undefined) return false;
    const newFiles = new Map<string, string>();
    for (const [relativePath] of plugin.files.entries()) {
      const fullPath = join(projectRoot, relativePath);
      if (!(await this.fs.fileExists(fullPath))) continue;
      const content = await this.fs.readFile(fullPath);
      newFiles.set(relativePath, this.hasher.hash(content).value);
    }
    manifest.updatePlugin(toolId, plugin.withFiles(newFiles));
    return true;
  }

  private buildSyncTotals(sourceTool: ToolId, toolResults: SyncToolResult[]): SyncResult {
    const count = (pred: (f: SyncFileResult) => boolean) =>
      toolResults.reduce((s, t) => s + t.files.filter(pred).length, 0);

    return {
      sourceTool,
      tools: toolResults,
      totalWritten: count((f) => f.written),
      totalDeleted: count((f) => Boolean(f.deleted)),
      totalConflicts: count((f) => f.conflict && !f.written),
      totalSkipped: count((f) => f.skipped),
    };
  }
}
