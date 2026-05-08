import { join } from "node:path";
import {
  DuplicatePluginError,
  MissingPluginVersionError,
  VersionMismatchError,
} from "../../../domain/errors.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import { DOCS_DIR, PLUGIN_CACHE_SUBDIR } from "../../../domain/models/paths.js";
import { Plugin } from "../../../domain/models/plugin.js";
import type { PluginDistribution } from "../../../domain/models/plugin-distribution.js";
import type { PluginSource } from "../../../domain/models/plugin-source.js";
import { PluginTranslator } from "../../../domain/models/plugin-translator.js";
import type { AiToolId } from "../../../domain/models/tool-ids.js";
import type { FileWriter } from "../../../domain/ports/file-writer.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import type { MarketplaceRegistry } from "../../../domain/ports/marketplace-registry.js";
import type { PluginDistributionReader } from "../../../domain/ports/plugin-distribution-reader.js";
import type { PluginFetcher } from "../../../domain/ports/plugin-fetcher.js";
import { getToolConfig, isAiTool } from "../../../domain/tools/registry.js";
import { loadPluginManifest, resolvePluginToolIds, writePluginFiles } from "./plugin-helpers.js";

const FLAT_PLUGINS_MODE = "flat";

export interface PluginAddOptions {
  source: PluginSource;
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  interactive: boolean;
  marketplace?: string;
  requiredVersion?: string;
  pluginMetadata?: { name: string; version: string; strict: boolean };
}

export class PluginAddUseCase {
  constructor(
    private readonly fs: FileWriter,
    private readonly manifestRepo: ManifestRepository,
    private readonly pluginFetcher: PluginFetcher,
    private readonly pluginDistributionReader: PluginDistributionReader,
    private readonly hasher: Hasher,
    private readonly marketplaceRegistry: MarketplaceRegistry
  ) {}

  async execute(options: PluginAddOptions): Promise<void> {
    const { source, toolIds, projectRoot, marketplace } = options;
    const manifest = await loadPluginManifest(this.manifestRepo);
    const resolvedToolIds = resolvePluginToolIds(toolIds, manifest);
    if (marketplace !== undefined && (await this.isGithubMarketplace(marketplace, projectRoot))) {
      await this.addGithubMarketplacePlugin(options, resolvedToolIds, manifest);
    } else {
      await this.addLocalPlugin(options, resolvedToolIds, manifest, source, projectRoot);
    }
    await this.manifestRepo.save(manifest);
  }

  private async isGithubMarketplace(name: string, projectRoot: string): Promise<boolean> {
    const all = await this.marketplaceRegistry.list(projectRoot);
    const found = all.find((m) => m.name === name);
    return found?.source.kind === "github";
  }

  private async addGithubMarketplacePlugin(
    options: PluginAddOptions,
    toolIds: AiToolId[],
    manifest: Manifest
  ): Promise<void> {
    const { pluginMetadata } = options;
    if (pluginMetadata === undefined) throw new MissingPluginVersionError();
    this.validateNoDuplicates(pluginMetadata.name, toolIds, manifest);
    const flatToolIds = toolIds.filter((id) => this.isFlatTool(id));
    const nativeToolIds = toolIds.filter((id) => !this.isFlatTool(id));
    if (flatToolIds.length > 0) {
      await this.addLocalPlugin(
        options,
        flatToolIds,
        manifest,
        options.source,
        options.projectRoot
      );
    }
    this.registerNativeGithubPlugins(options, nativeToolIds, manifest);
  }

  private isFlatTool(toolId: AiToolId): boolean {
    const toolConfig = getToolConfig(toolId);
    if (!isAiTool(toolConfig)) return false;
    if (!("plugins" in (toolConfig.capabilities as object))) return false;
    return (
      (toolConfig.capabilities as { plugins: { mode: string } }).plugins.mode === FLAT_PLUGINS_MODE
    );
  }

  private registerNativeGithubPlugins(
    options: PluginAddOptions,
    toolIds: AiToolId[],
    manifest: Manifest
  ): void {
    const { pluginMetadata, marketplace, source } = options;
    if (pluginMetadata === undefined) return;
    for (const toolId of toolIds) {
      manifest.addPlugin(
        toolId,
        Plugin.fromMetadata(
          pluginMetadata.name,
          pluginMetadata.version,
          source,
          pluginMetadata.strict,
          marketplace
        )
      );
    }
  }

  private async addLocalPlugin(
    options: PluginAddOptions,
    resolvedToolIds: AiToolId[],
    manifest: Manifest,
    source: PluginSource,
    projectRoot: string
  ): Promise<void> {
    const { marketplace, requiredVersion } = options;
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
