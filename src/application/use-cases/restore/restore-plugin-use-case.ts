import { join } from "node:path";
import { PluginNotFoundError } from "../../../domain/errors.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import { PLUGIN_CACHE_SUBDIR } from "../../../domain/models/paths.js";
import { PluginTranslator } from "../../../domain/models/plugin-translator.js";
import { AI_TOOL_IDS, type AiToolId } from "../../../domain/models/tool-ids.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import type { PluginDistributionReader } from "../../../domain/ports/plugin-distribution-reader.js";
import type { PluginFetcher } from "../../../domain/ports/plugin-fetcher.js";
import { getToolConfig, isAiTool } from "../../../domain/tools/registry.js";
import { NoManifestError } from "../../errors.js";

export interface RestorePluginOptions {
  pluginName: string;
  projectRoot: string;
  repo?: string;
}

export interface RestorePluginResult {
  totalRestored: number;
}

export class RestorePluginUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly pluginFetcher: PluginFetcher,
    private readonly pluginDistributionReader: PluginDistributionReader,
    private readonly hasher: Hasher
  ) {}

  async execute(options: RestorePluginOptions): Promise<RestorePluginResult> {
    const { pluginName, projectRoot, repo } = options;
    const manifest = await this.manifestRepo.load();

    if (manifest === null) throw new NoManifestError(repo);

    const cacheDir = join(projectRoot, PLUGIN_CACHE_SUBDIR);
    const toolIds = AI_TOOL_IDS.filter((id) => manifest.hasTool(id)) as AiToolId[];

    let totalRestored = 0;

    for (const toolId of toolIds) {
      const count = await this.restorePluginForTool(
        toolId,
        pluginName,
        projectRoot,
        cacheDir,
        manifest
      );
      totalRestored += count;
    }

    if (totalRestored === 0) throw new PluginNotFoundError(pluginName);

    await this.manifestRepo.save(manifest);

    return { totalRestored };
  }

  private async restorePluginForTool(
    toolId: AiToolId,
    pluginName: string,
    projectRoot: string,
    cacheDir: string,
    manifest: Manifest
  ): Promise<number> {
    const plugin = manifest.getPlugins(toolId).find((p) => p.name === pluginName);

    if (plugin === undefined) return 0;

    const toolConfig = getToolConfig(toolId);

    if (!isAiTool(toolConfig)) return 0;

    const localPath = await this.pluginFetcher.fetch(plugin.source, cacheDir);
    const dist = await this.pluginDistributionReader.read(localPath);
    const files = new PluginTranslator(this.hasher).translate(dist, toolConfig);

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
