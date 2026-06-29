import { join } from "node:path";
import type { PluginsCapability } from "../../../../domain/capabilities/plugins-capability.js";
import { InstallationFile } from "../../../../domain/models/file.js";
import type { Manifest } from "../../../../domain/models/manifest.js";
import { Plugin } from "../../../../domain/models/plugin.js";
import type { PluginDistribution } from "../../../../domain/models/plugin-distribution.js";
import type { PluginSource } from "../../../../domain/models/plugin-source.js";
import type { ReadonlySkipList } from "../../../../domain/models/plugin-translation-skip.js";
import type { AiToolId } from "../../../../domain/models/tool-ids.js";
import type { FileReader } from "../../../../domain/ports/file-reader.js";
import type { FileWriter } from "../../../../domain/ports/file-writer.js";
import type { Hasher } from "../../../../domain/ports/hasher.js";
import type { MarketplaceRegistry } from "../../../../domain/ports/marketplace-registry.js";
import { getToolConfig, isAiTool } from "../../../../domain/tools/registry.js";
import type { EnsureBuiltMarketplaceUseCase } from "../../shared/ensure-built-marketplace-use-case.js";
import { writePluginFiles } from "../plugin-helpers.js";
import { ModeBFlatMaterializationTranslator } from "./mode-b-flat-materialization-translator.js";
import type { PluginTranslator } from "./plugin-translator.js";

/**
 * Materializes plugin content by copying the per-target BUILT tree verbatim into the
 * tool's plugin directory — so installed bytes equal `framework build` output. Bypasses
 * the per-file content transform (build already did it). For marketplace-sourced installs
 * only; raw local-path installs fall back to flat materialization.
 *
 * componentPaths is left empty (sync does not propagate built plugins), matching the
 * existing local-marketplace behavior in PluginUpdateUseCase.
 */
export class BuiltTreeMaterializationTranslator implements PluginTranslator {
  readonly mode = "flat" as const;

  constructor(
    private readonly fs: FileWriter & FileReader,
    private readonly hasher: Hasher,
    private readonly homedir: () => string,
    private readonly ensureBuilt: EnsureBuiltMarketplaceUseCase,
    private readonly marketplaceRegistry: MarketplaceRegistry
  ) {}

  async addPlugin(
    dist: PluginDistribution,
    toolId: AiToolId,
    source: PluginSource,
    projectRoot: string,
    manifest: Manifest,
    marketplace: string | undefined,
    docsDir: string,
    previousMcpEntries: ReadonlyMap<string, string> = new Map()
  ): Promise<{ skipped: ReadonlySkipList }> {
    const resolved =
      marketplace === undefined ? null : await this.findMarketplace(marketplace, projectRoot);
    if (marketplace === undefined || resolved === null) {
      return this.fallback().addPlugin(
        dist,
        toolId,
        source,
        projectRoot,
        manifest,
        marketplace,
        docsDir,
        previousMcpEntries
      );
    }
    const { builtDir } = await this.ensureBuilt.execute({
      projectRoot,
      marketplace: resolved,
      target: toolId,
      mode: "marketplace",
    });
    await this.materializeUserScope(
      dist,
      toolId,
      source,
      projectRoot,
      manifest,
      marketplace,
      builtDir
    );
    return { skipped: [] };
  }

  private async materializeUserScope(
    dist: PluginDistribution,
    toolId: AiToolId,
    source: PluginSource,
    projectRoot: string,
    manifest: Manifest,
    marketplace: string,
    builtDir: string
  ): Promise<void> {
    const pluginSrc = join(builtDir, "plugins", dist.manifest.name);
    const files = await this.readBuiltFiles(pluginSrc, dist.manifest.name);
    const baseDir = this.resolveBaseDir(toolId, projectRoot);
    await writePluginFiles(files, baseDir, this.fs);
    manifest.addPlugin(
      toolId,
      Plugin.fromDistribution(dist, source, files, new Map(), marketplace)
    );
  }

  // Build emits plugins/<name>/<rel>; cursor installs at <baseDir>/<name>/<rel>, so the
  // manifest relativePath keeps the <name>/ prefix to match the on-disk layout.
  private async readBuiltFiles(pluginSrc: string, name: string): Promise<InstallationFile[]> {
    const absPaths = await this.fs.listFilesRecursive(pluginSrc);
    return Promise.all(
      absPaths.map(async (abs) => {
        const rel = abs.slice(pluginSrc.length + 1);
        const content = await this.fs.readFile(abs);
        return new InstallationFile({
          relativePath: join(name, rel),
          content,
          hash: this.hasher.hash(content),
        });
      })
    );
  }

  private resolveBaseDir(toolId: AiToolId, projectRoot: string): string {
    const toolConfig = getToolConfig(toolId);
    if (!isAiTool(toolConfig)) return projectRoot;
    const plugins = (toolConfig.capabilities as { plugins: PluginsCapability }).plugins;
    return plugins.resolvePluginsBaseDir(projectRoot, this.homedir());
  }

  private async findMarketplace(name: string, projectRoot: string) {
    const all = await this.marketplaceRegistry.list(projectRoot);
    return all.find((m) => m.name === name) ?? null;
  }

  private fallback(): ModeBFlatMaterializationTranslator {
    return new ModeBFlatMaterializationTranslator(this.fs, this.hasher, this.homedir);
  }
}
