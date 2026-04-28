import { dirname, join } from "node:path";
import { PluginNotFoundError } from "../../../domain/errors.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import type { AiToolId } from "../../../domain/models/tool-ids.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import { loadPluginManifest, resolvePluginToolIds } from "./plugin-helpers.js";

export interface PluginRemoveOptions {
  pluginName: string;
  toolIds: AiToolId[] | "all";
  projectRoot: string;
}

export class PluginRemoveUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository
  ) {}

  async execute(options: PluginRemoveOptions): Promise<void> {
    const { pluginName, toolIds, projectRoot } = options;
    const manifest = await loadPluginManifest(this.manifestRepo);
    const resolvedToolIds = resolvePluginToolIds(toolIds, manifest);
    const removed = await this.removeFromTools(pluginName, resolvedToolIds, projectRoot, manifest);
    if (!removed) throw new PluginNotFoundError(pluginName);
    await this.manifestRepo.save(manifest);
  }

  private async removeFromTools(
    pluginName: string,
    toolIds: AiToolId[],
    projectRoot: string,
    manifest: Manifest
  ): Promise<boolean> {
    let removed = false;
    for (const toolId of toolIds) {
      const plugins = manifest.getPlugins(toolId);
      const plugin = plugins.find((p) => p.name === pluginName);
      if (plugin === undefined) continue;
      await this.deletePluginFiles(plugin.files, projectRoot);
      manifest.removePlugin(toolId, pluginName);
      removed = true;
    }
    return removed;
  }

  private async deletePluginFiles(
    files: ReadonlyMap<string, string>,
    projectRoot: string
  ): Promise<void> {
    for (const relativePath of files.keys()) {
      const fullPath = join(projectRoot, relativePath);
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
    }
  }
}
