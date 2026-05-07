import { join } from "node:path";
import type { PluginIssueEntry } from "../../../domain/models/doctor.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import type { AiToolId } from "../../../domain/models/tool-ids.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";

export interface DoctorPluginOptions {
  manifest: Manifest;
  projectRoot: string;
  allowedIds: Set<string> | null;
  pluginName?: string;
}

export class DoctorPluginUseCase {
  constructor(private readonly fs: FileSystem) {}

  async execute(options: DoctorPluginOptions): Promise<PluginIssueEntry[]> {
    const { manifest, projectRoot, allowedIds, pluginName } = options;
    const result: PluginIssueEntry[] = [];
    for (const toolId of manifest.getInstalledToolIds()) {
      if (allowedIds && !allowedIds.has(toolId)) continue;
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
  ): Promise<PluginIssueEntry[]> {
    const plugins = manifest.getPlugins(toolId);
    const targets = pluginName ? plugins.filter((p) => p.name === pluginName) : plugins;
    const result: PluginIssueEntry[] = [];
    for (const plugin of targets) {
      const issues = await this.checkOnePlugin(toolId, plugin.name, plugin.files, projectRoot);
      result.push(...issues);
    }
    return result;
  }

  private async checkOnePlugin(
    toolId: AiToolId,
    pluginName: string,
    files: ReadonlyMap<string, string>,
    projectRoot: string
  ): Promise<PluginIssueEntry[]> {
    const issues: PluginIssueEntry[] = [];
    for (const [relativePath, expectedHash] of files.entries()) {
      const fullPath = join(projectRoot, relativePath);
      if (!(await this.fs.fileExists(fullPath))) {
        issues.push({ toolId, pluginName, issue: "missing", filePath: relativePath });
      } else {
        const diskHash = await this.fs.readFileHash(fullPath);
        if (diskHash.value !== expectedHash) {
          issues.push({ toolId, pluginName, issue: "hash-mismatch", filePath: relativePath });
        }
      }
    }
    return issues;
  }
}
