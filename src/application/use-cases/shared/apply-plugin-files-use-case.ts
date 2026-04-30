import { join } from "node:path";
import type { Manifest } from "../../../domain/models/manifest.js";
import type { Plugin } from "../../../domain/models/plugin.js";
import { PluginTranslator } from "../../../domain/models/plugin-translator.js";
import type { AiToolId } from "../../../domain/models/tool-ids.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { PluginDistributionReader } from "../../../domain/ports/plugin-distribution-reader.js";
import type { PluginFetcher } from "../../../domain/ports/plugin-fetcher.js";
import type { ToolConfig } from "../../../domain/tools/registry.js";

interface ApplyPluginFilesOptions {
  toolId: AiToolId;
  plugin: Plugin;
  toolConfig: ToolConfig;
  projectRoot: string;
  cacheDir: string;
  manifest: Manifest;
  docsDir: string;
}

export class ApplyPluginFilesUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly hasher: Hasher,
    private readonly pluginFetcher: PluginFetcher,
    private readonly pluginDistributionReader: PluginDistributionReader
  ) {}

  async execute(options: ApplyPluginFilesOptions): Promise<number> {
    const { toolId, plugin, toolConfig, projectRoot, cacheDir, manifest, docsDir } = options;
    const localPath = await this.pluginFetcher.fetch(plugin.source, cacheDir);
    const dist = await this.pluginDistributionReader.read(localPath);
    const files = new PluginTranslator(this.hasher).translate(dist, toolConfig, docsDir);
    await Promise.all(
      files.map((f) => this.fs.writeFile(join(projectRoot, f.relativePath), f.content))
    );
    manifest.updatePlugin(
      toolId,
      plugin.withFiles(new Map(files.map((f) => [f.relativePath, f.hash.value])))
    );
    return files.length;
  }
}
