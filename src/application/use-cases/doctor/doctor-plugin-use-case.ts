import { homedir } from "node:os";
import { join } from "node:path";
import type { PluginsCapability } from "../../../domain/capabilities/plugins-capability.js";
import type { PluginIssueEntry } from "../../../domain/models/doctor.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import type { AiToolId } from "../../../domain/models/tool-ids.js";
import type { FileReader } from "../../../domain/ports/file-reader.js";
import { getToolConfig, isAiTool } from "../../../domain/tools/registry.js";

export interface DoctorPluginOptions {
  manifest: Manifest;
  projectRoot: string;
  allowedIds: Set<string> | null;
  pluginName?: string;
}

export class DoctorPluginUseCase {
  constructor(private readonly fs: FileReader) {}

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
    const baseDir = this.resolveBaseDir(toolId, projectRoot);
    const result: PluginIssueEntry[] = [];
    for (const plugin of targets) {
      const issues = await this.checkOnePlugin(toolId, plugin.name, plugin.files, baseDir);
      result.push(...issues);
    }
    return result;
  }

  private resolveBaseDir(toolId: AiToolId, projectRoot: string): string {
    const tool = getToolConfig(toolId);
    if (tool === undefined || !isAiTool(tool)) return projectRoot;
    const caps = tool.capabilities as Record<string, unknown>;
    const plugins = caps.plugins as PluginsCapability | undefined;
    if (plugins === undefined) return projectRoot;
    return plugins.resolvePluginsBaseDir(projectRoot, homedir());
  }

  private async checkOnePlugin(
    toolId: AiToolId,
    pluginName: string,
    files: ReadonlyMap<string, string>,
    baseDir: string
  ): Promise<PluginIssueEntry[]> {
    const issues: PluginIssueEntry[] = [];
    for (const [relativePath, expectedHash] of files.entries()) {
      const fullPath = join(baseDir, relativePath);
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
