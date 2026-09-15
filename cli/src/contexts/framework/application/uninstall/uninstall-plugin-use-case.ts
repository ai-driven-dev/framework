import { NoManifestError, PluginNotFoundError } from "../../../../kernel/errors.js";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../kernel/ports/file-writer.js";
import type { AiToolId, ToolId } from "../../../../kernel/tool.js";
import { AI_TOOL_IDS } from "../../../../kernel/tool.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import { detachNativePluginRefs } from "../ownership/native-plugin-ownership.js";
import { ProjectPluginCleanup } from "../ownership/project-plugin-cleanup.js";
import { detachUserPlugin } from "../ownership/user-plugin-ownership.js";
import { deletePluginFilesForTool } from "../plugin/plugin-helpers.js";

export interface UninstallPluginOptions {
  pluginName: string;
  toolIds: ToolId[];
  projectRoot: string;
}

export interface UninstallPluginResult {
  toolId: ToolId;
  fileCount: number;
  deletedFiles: string[];
}

export class UninstallPluginUseCase {
  constructor(
    private readonly fs: FileWriter & FileReader,
    private readonly manifestRepo: ManifestRepository,
    private readonly userManifestRepo?: ManifestRepository
  ) {}

  async execute(options: UninstallPluginOptions): Promise<UninstallPluginResult[]> {
    const { pluginName, toolIds, projectRoot } = options;
    const manifest = await this.manifestRepo.load();
    if (manifest === null) throw new NoManifestError();
    const scope = this.resolveToolScope(toolIds, manifest);
    const userTools = scope.filter((toolId) =>
      manifest.getPlugins(toolId).some((p) => p.name === pluginName && p.scope === "user")
    );
    const nativeRefs = new Map<ToolId, readonly string[]>();
    const cleanup = new ProjectPluginCleanup(this.fs, this.userManifestRepo);
    for (const toolId of scope) {
      const plugin = manifest.getPlugins(toolId).find((candidate) => candidate.name === pluginName);
      if (plugin !== undefined)
        await cleanup.assertLocalIntegrationRemovable(toolId, plugin, projectRoot);
      const hostName = manifest
        .getNativeRegistrations(toolId)
        ?.marketplaces.find((m) => m.alias === plugin?.marketplace)?.hostName;
      if (hostName !== undefined) nativeRefs.set(toolId, [`${pluginName}@${hostName}`]);
    }
    const results = await this.removeFromTools(pluginName, scope, projectRoot, manifest);
    if (results.length === 0) throw new PluginNotFoundError(pluginName);
    await this.manifestRepo.save(manifest);
    await detachNativePluginRefs(this.userManifestRepo, this.fs, projectRoot, nativeRefs);
    for (const toolId of userTools) {
      await detachUserPlugin(this.userManifestRepo, this.fs, toolId, pluginName, projectRoot);
    }
    return results;
  }

  private resolveToolScope(toolIds: ToolId[], manifest: Manifest): AiToolId[] {
    if (toolIds.length > 0) return toolIds.filter((id) => manifest.hasTool(id)) as AiToolId[];
    return AI_TOOL_IDS.filter((id) => manifest.hasTool(id)) as AiToolId[];
  }

  private async removeFromTools(
    pluginName: string,
    toolIds: AiToolId[],
    projectRoot: string,
    manifest: Manifest
  ): Promise<UninstallPluginResult[]> {
    const results: UninstallPluginResult[] = [];
    const cleanup = new ProjectPluginCleanup(this.fs, this.userManifestRepo);
    for (const toolId of toolIds) {
      const plugin = manifest.getPlugins(toolId).find((p) => p.name === pluginName);
      if (plugin === undefined) continue;
      await cleanup.removeLocalIntegration(toolId, plugin, projectRoot);
      const registrations = manifest.getNativeRegistrations(toolId);
      const hostName = registrations?.marketplaces.find(
        (m) => m.alias === plugin.marketplace
      )?.hostName;
      if (registrations !== undefined && hostName !== undefined)
        manifest.setNativeRegistrations(toolId, {
          ...registrations,
          pluginRefs: registrations.pluginRefs.filter(
            (ref) => ref !== `${plugin.name}@${hostName}`
          ),
        });
      const deletedFiles = await deletePluginFilesForTool(
        plugin.files,
        plugin.scope,
        toolId,
        projectRoot,
        this.fs
      );
      manifest.removePlugin(toolId, pluginName);
      results.push({ toolId, fileCount: deletedFiles.length, deletedFiles });
    }
    return results;
  }
}
