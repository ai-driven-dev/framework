import { homedir as nodeHomedir } from "node:os";
import { dirname, join } from "node:path";
import { McpCapability } from "../../../domain/capabilities/mcp-capability.js";
import type { PluginsCapability } from "../../../domain/capabilities/plugins-capability.js";
import { PluginNotFoundError } from "../../../domain/errors.js";
import { unmergeOpencodeMcp } from "../../../domain/formats/opencode-mcp-merge.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import type { Plugin } from "../../../domain/models/plugin.js";
import type { AiToolId } from "../../../domain/models/tool-ids.js";
import type { FileReader } from "../../../domain/ports/file-reader.js";
import type { FileWriter } from "../../../domain/ports/file-writer.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import { getToolConfig, isAiTool } from "../../../domain/tools/registry.js";
import { loadPluginManifest, resolvePluginToolIds } from "./plugin-helpers.js";

export interface PluginRemoveOptions {
  pluginName: string;
  toolIds: AiToolId[] | "all";
  projectRoot: string;
}

export class PluginRemoveUseCase {
  constructor(
    private readonly fs: FileWriter & FileReader,
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
      const baseDir = this.resolveBaseDir(toolId, projectRoot);
      await this.deletePluginFiles(plugin.files, baseDir);
      await this.removeMcpEntries(plugin, toolId, projectRoot);
      manifest.removePlugin(toolId, pluginName);
      removed = true;
    }
    return removed;
  }

  private async removeMcpEntries(
    plugin: Plugin,
    toolId: AiToolId,
    projectRoot: string
  ): Promise<void> {
    if (plugin.mcpEntries.size === 0) return;
    const toolConfig = getToolConfig(toolId);
    if (!isAiTool(toolConfig)) return;
    const caps = toolConfig.capabilities as Record<string, unknown>;
    if (!this.qualifiesForOpencodeMcpMerge(caps)) return;
    const mcpCap = caps.mcp as McpCapability;
    const outputRelPath = await mcpCap.resolveOutput(projectRoot, this.fs);
    const outputPath = join(projectRoot, outputRelPath);
    const existing = await this.readExistingJson(outputPath);
    if (existing === null) return;
    const updated = unmergeOpencodeMcp(existing, plugin.mcpEntries);
    await this.fs.writeFile(outputPath, updated);
  }

  private qualifiesForOpencodeMcpMerge(caps: Record<string, unknown>): boolean {
    if (!("mcp" in caps)) return false;
    const mcp = caps.mcp;
    if (!(mcp instanceof McpCapability)) return false;
    if (mcp.params.mergeStrategy !== "framework-prime") return false;
    const plugins = caps.plugins as PluginsCapability;
    return plugins.mode === "flat";
  }

  private async readExistingJson(path: string): Promise<string | null> {
    try {
      return await this.fs.readFile(path);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  private async deletePluginFiles(
    files: ReadonlyMap<string, string>,
    baseDir: string
  ): Promise<void> {
    for (const relativePath of files.keys()) {
      const fullPath = join(baseDir, relativePath);
      await this.fs.deleteFile(fullPath);
      await this.fs.deleteEmptyDirectories(dirname(fullPath));
    }
  }

  private resolveBaseDir(toolId: AiToolId, projectRoot: string): string {
    const toolConfig = getToolConfig(toolId);
    if (!isAiTool(toolConfig)) return projectRoot;
    const caps = toolConfig.capabilities as Record<string, unknown>;
    if (!("plugins" in caps)) return projectRoot;
    const pluginsCap = caps.plugins as PluginsCapability;
    if (pluginsCap.installScope !== "user") return projectRoot;
    return pluginsCap.resolvePluginsBaseDir(projectRoot, nodeHomedir());
  }
}
