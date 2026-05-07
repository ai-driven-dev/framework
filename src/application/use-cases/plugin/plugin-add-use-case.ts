import { join } from "node:path";
import { DuplicatePluginError, VersionMismatchError } from "../../../domain/errors.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import { DOCS_DIR, PLUGIN_CACHE_SUBDIR } from "../../../domain/models/paths.js";
import { Plugin } from "../../../domain/models/plugin.js";
import type { PluginDistribution } from "../../../domain/models/plugin-distribution.js";
import type { PluginSource } from "../../../domain/models/plugin-source.js";
import { PluginTranslator } from "../../../domain/models/plugin-translator.js";
import type { AiToolId } from "../../../domain/models/tool-ids.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import type { PluginDistributionReader } from "../../../domain/ports/plugin-distribution-reader.js";
import type { PluginFetcher } from "../../../domain/ports/plugin-fetcher.js";
import { getToolConfig, isAiTool } from "../../../domain/tools/registry.js";
import { loadPluginManifest, resolvePluginToolIds, writePluginFiles } from "./plugin-helpers.js";

export interface PluginAddOptions {
  source: PluginSource;
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  interactive: boolean;
  marketplace?: string;
  requiredVersion?: string;
}

export class PluginAddUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly pluginFetcher: PluginFetcher,
    private readonly pluginDistributionReader: PluginDistributionReader,
    private readonly hasher: Hasher
  ) {}

  async execute(options: PluginAddOptions): Promise<void> {
    const { source, toolIds, projectRoot, marketplace, requiredVersion } = options;
    const manifest = await loadPluginManifest(this.manifestRepo);
    const resolvedToolIds = resolvePluginToolIds(toolIds, manifest);
    const cacheDir = join(projectRoot, PLUGIN_CACHE_SUBDIR);
    const localPath = await this.pluginFetcher.fetch(source, cacheDir);
    const dist = await this.pluginDistributionReader.read(localPath);
    this.assertPluginVersionMatches(dist.manifest.name, dist.manifest.version, requiredVersion);
    this.validateNoDuplicates(dist.manifest.name, resolvedToolIds, manifest);
    const docsDir = DOCS_DIR;
    for (const toolId of resolvedToolIds) {
      await this.addPluginForTool(
        dist,
        toolId,
        source,
        projectRoot,
        manifest,
        marketplace,
        docsDir
      );
    }
    await this.manifestRepo.save(manifest);
  }

  private assertPluginVersionMatches(
    name: string,
    actual: string,
    requested: string | undefined
  ): void {
    if (!requested) return;
    if (actual !== requested) throw new VersionMismatchError(name, requested, actual);
  }

  private validateNoDuplicates(pluginName: string, toolIds: AiToolId[], manifest: Manifest): void {
    for (const toolId of toolIds) {
      const exists = manifest.getPlugins(toolId).some((p) => p.name === pluginName);
      if (exists) throw new DuplicatePluginError(pluginName);
    }
  }

  private async addPluginForTool(
    dist: PluginDistribution,
    toolId: AiToolId,
    source: PluginSource,
    projectRoot: string,
    manifest: Manifest,
    marketplace: string | undefined,
    docsDir: string
  ): Promise<void> {
    const toolConfig = getToolConfig(toolId);
    if (!isAiTool(toolConfig)) return;
    const { files, componentPaths } = new PluginTranslator(this.hasher).translateWithComponentPaths(
      dist,
      toolConfig,
      docsDir
    );
    if (files.length === 0) return;
    const isLocalMarketplace = source.kind === "local" && marketplace !== undefined;
    if (!isLocalMarketplace) await writePluginFiles(files, projectRoot, this.fs);
    manifest.addPlugin(
      toolId,
      Plugin.fromDistribution(
        dist,
        source,
        isLocalMarketplace ? [] : files,
        isLocalMarketplace ? new Map() : componentPaths,
        marketplace
      )
    );
  }
}
