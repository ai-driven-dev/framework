import { join } from "node:path";
import { FlatCollisionError } from "../../../domain/errors.js";
import type { InstallationFile } from "../../../domain/models/file.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import { PLUGIN_CACHE_SUBDIR } from "../../../domain/models/paths.js";
import { Plugin } from "../../../domain/models/plugin.js";
import type { PluginDistribution } from "../../../domain/models/plugin-distribution.js";
import type { PluginSource } from "../../../domain/models/plugin-source.js";
import { PluginTranslator } from "../../../domain/models/plugin-translator.js";
import type { ToolId } from "../../../domain/models/tool-ids.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { PluginDistributionReader } from "../../../domain/ports/plugin-distribution-reader.js";
import type { PluginFetcher } from "../../../domain/ports/plugin-fetcher.js";
import type { ToolConfig } from "../../../domain/tools/registry.js";
import { isAiTool } from "../../../domain/tools/registry.js";

interface InstallPluginsOptions {
  plugins: PluginSource[];
  toolConfigs: ToolConfig[];
  projectRoot: string;
  manifest: Manifest;
  docsDir: string;
  force?: boolean;
}

export class InstallPluginsUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly pluginFetcher: PluginFetcher,
    private readonly pluginDistributionReader: PluginDistributionReader,
    private readonly hasher: Hasher
  ) {}

  async execute(options: InstallPluginsOptions): Promise<Map<ToolId, string[]>> {
    const { plugins, toolConfigs, projectRoot, manifest, docsDir, force = false } = options;
    const cacheDir = join(projectRoot, PLUGIN_CACHE_SUBDIR);
    const dists = await this.fetchAll(plugins, cacheDir);
    this.validateCollisions(dists, toolConfigs);
    const warningsMap = new Map<ToolId, string[]>();
    for (let i = 0; i < plugins.length; i++) {
      for (const tc of toolConfigs) {
        const warnings = await this.installPluginForTool(
          dists[i],
          tc,
          plugins[i],
          projectRoot,
          manifest,
          docsDir,
          force
        );
        if (warnings.length > 0 && isAiTool(tc)) {
          const existing = warningsMap.get(tc.toolId) ?? [];
          warningsMap.set(tc.toolId, [...existing, ...warnings]);
        }
      }
    }
    return warningsMap;
  }

  private async fetchAll(plugins: PluginSource[], cacheDir: string): Promise<PluginDistribution[]> {
    return Promise.all(
      plugins.map(async (source) => {
        const localPath = await this.pluginFetcher.fetch(source, cacheDir);
        return this.pluginDistributionReader.read(localPath);
      })
    );
  }

  private validateCollisions(dists: PluginDistribution[], toolConfigs: ToolConfig[]): void {
    const translator = new PluginTranslator(this.hasher);
    for (const toolConfig of toolConfigs) {
      const collisions = translator.detectFlatCollisions(dists, toolConfig);
      if (collisions.length > 0) {
        throw new FlatCollisionError(collisions[0].plugin, collisions[0].path);
      }
    }
  }

  private async installPluginForTool(
    dist: PluginDistribution,
    toolConfig: ToolConfig,
    source: PluginSource,
    projectRoot: string,
    manifest: Manifest,
    docsDir: string,
    force: boolean
  ): Promise<string[]> {
    const { files, componentPaths } = new PluginTranslator(this.hasher).translateWithComponentPaths(
      dist,
      toolConfig,
      docsDir
    );
    if (files.length === 0) return [];
    if (!isAiTool(toolConfig)) {
      await this.writeFiles(files, projectRoot, manifest);
      return [];
    }
    const pluginName = dist.manifest.name;
    const existingPlugin = manifest
      .getPlugins(toolConfig.toolId)
      .find((p) => p.name === pluginName);
    if (existingPlugin && !force) return [];
    const { written, conflicts } = await this.writeFiles(files, projectRoot, manifest);
    const plugin = Plugin.fromDistribution(dist, source, written, componentPaths);
    if (existingPlugin) {
      await this.deleteStaleFiles(existingPlugin, written, projectRoot);
      manifest.updatePlugin(toolConfig.toolId, plugin);
    } else {
      manifest.addPlugin(toolConfig.toolId, plugin);
    }
    return conflicts.map(
      (p) => `\`${p}\` already exists and was not installed by AIDD — skipped to preserve user file`
    );
  }

  private async writeFiles(
    files: InstallationFile[],
    projectRoot: string,
    manifest: Manifest
  ): Promise<{ written: InstallationFile[]; conflicts: string[] }> {
    const written: InstallationFile[] = [];
    const conflicts: string[] = [];
    for (const f of files) {
      const outputPath = join(projectRoot, f.relativePath);
      const exists = await this.fs.fileExists(outputPath);
      if (exists && !manifest.isFileTracked(f.relativePath)) {
        conflicts.push(f.relativePath);
        continue;
      }
      await this.fs.writeFile(outputPath, f.content);
      written.push(f);
    }
    return { written, conflicts };
  }

  private async deleteStaleFiles(
    existing: Plugin,
    newFiles: InstallationFile[],
    projectRoot: string
  ): Promise<void> {
    const newPaths = new Set(newFiles.map((f) => f.relativePath));
    for (const relativePath of existing.files.keys()) {
      if (!newPaths.has(relativePath)) {
        await this.fs.deleteFile(join(projectRoot, relativePath));
      }
    }
  }
}
