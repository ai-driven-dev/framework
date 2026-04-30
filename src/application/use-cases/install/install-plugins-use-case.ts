import { join } from "node:path";
import { FlatCollisionError } from "../../../domain/errors.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import { PLUGIN_CACHE_SUBDIR } from "../../../domain/models/paths.js";
import { Plugin } from "../../../domain/models/plugin.js";
import type { PluginDistribution } from "../../../domain/models/plugin-distribution.js";
import type { PluginSource } from "../../../domain/models/plugin-source.js";
import { PluginTranslator } from "../../../domain/models/plugin-translator.js";
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
}

export class InstallPluginsUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly pluginFetcher: PluginFetcher,
    private readonly pluginDistributionReader: PluginDistributionReader,
    private readonly hasher: Hasher
  ) {}

  async execute(options: InstallPluginsOptions): Promise<void> {
    const { plugins, toolConfigs, projectRoot, manifest, docsDir } = options;
    const cacheDir = join(projectRoot, PLUGIN_CACHE_SUBDIR);
    const dists = await this.fetchAll(plugins, cacheDir);
    this.validateCollisions(dists, toolConfigs);
    for (let i = 0; i < plugins.length; i++) {
      await Promise.all(
        toolConfigs.map((tc) =>
          this.installPluginForTool(dists[i], tc, plugins[i], projectRoot, manifest, docsDir)
        )
      );
    }
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
    docsDir: string
  ): Promise<void> {
    const files = new PluginTranslator(this.hasher).translate(dist, toolConfig, docsDir);
    if (files.length === 0) return;
    await Promise.all(
      files.map((f) => this.fs.writeFile(join(projectRoot, f.relativePath), f.content))
    );
    if (!isAiTool(toolConfig)) return;
    manifest.addPlugin(toolConfig.toolId, Plugin.fromDistribution(dist, source, files));
  }
}
