import { join } from "node:path";
import type { Manifest } from "../../../domain/models/manifest.js";
import type { Plugin } from "../../../domain/models/plugin.js";
import { PluginTranslator } from "../../../domain/models/plugin-translator.js";
import type { AiToolId } from "../../../domain/models/tool-ids.js";
import type { FileReader } from "../../../domain/ports/file-reader.js";
import type { FileWriter } from "../../../domain/ports/file-writer.js";
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
  fileFilter?: ((relativePath: string) => boolean) | null;
}

export class ApplyPluginFilesUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly hasher: Hasher,
    private readonly pluginFetcher: PluginFetcher,
    private readonly pluginDistributionReader: PluginDistributionReader
  ) {}

  async execute(options: ApplyPluginFilesOptions): Promise<number> {
    const { toolId, plugin, toolConfig, projectRoot, cacheDir, manifest, docsDir, fileFilter } =
      options;
    const localPath = await this.pluginFetcher.fetch(plugin.source, cacheDir);
    const dist = await this.pluginDistributionReader.read(localPath);
    const files = new PluginTranslator(this.hasher).translate(dist, toolConfig, docsDir);
    let restored = 0;
    for (const f of files) {
      if (fileFilter !== null && fileFilter !== undefined && !fileFilter(f.relativePath)) continue;
      const outputPath = join(projectRoot, f.relativePath);
      if (!(await this.isFileAtDesiredState(outputPath, f.hash.value))) {
        await this.fs.writeFile(outputPath, f.content);
        restored++;
      }
    }
    manifest.updatePlugin(
      toolId,
      plugin.withFiles(new Map(files.map((f) => [f.relativePath, f.hash.value])))
    );
    return restored;
  }

  private async isFileAtDesiredState(
    outputPath: string,
    expectedHashValue: string
  ): Promise<boolean> {
    try {
      const content = await this.fs.readFile(outputPath);
      return this.hasher.hash(content).value === expectedHashValue;
    } catch {
      return false;
    }
  }
}
