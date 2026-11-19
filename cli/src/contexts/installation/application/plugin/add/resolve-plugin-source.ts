import { homedir as nodeHomedir, platform as nodePlatform } from "node:os";
import { join } from "node:path";
import type { PluginDistribution } from "../../../../../shared/domain/plugin/plugin-distribution.js";
import type { PluginSource } from "../../../../../shared/domain/source.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { BuiltMarketplaceEnsurer } from "../../../contract/built-marketplace.js";
import { PLUGIN_CACHE_SUBDIR } from "../../../domain/project-layout.js";
import type { InstallationMarketplaceRegistry } from "../../../ports/marketplace-sources.js";
import type {
  PluginTranslation,
  PluginTranslationCommand,
  PluginTranslationResult,
} from "../../../ports/plugin/plugin-translation.js";
import type { PluginTranslator } from "../../materialize/plugin-translator.js";
import { resolvePluginTranslator } from "../../materialize/resolve-plugin-translator.js";
import type { PluginDistributionLoader } from "../plugin-distribution-loader.js";

/** Where a plugin's files come from. */
export interface AddPluginSources {
  distributionLoader: PluginDistributionLoader;
  marketplaceRegistry: InstallationMarketplaceRegistry;
  ensureBuilt: BuiltMarketplaceEnsurer;
  translate: PluginTranslation;
}

/** Answers where an added plugin comes from: its marketplace, its distribution, its translation. */
export class ResolveAddedPluginSource {
  constructor(private readonly sources: AddPluginSources) {}

  async isGithubMarketplace(name: string, projectRoot: string): Promise<boolean> {
    const all = await this.sources.marketplaceRegistry.list(projectRoot);
    const found = all.find((m) => m.name === name);
    return found?.source.kind === "github";
  }

  readDistribution(source: PluginSource, projectRoot: string): Promise<PluginDistribution> {
    const cacheDir = join(projectRoot, PLUGIN_CACHE_SUBDIR);
    return this.sources.distributionLoader.load(source, cacheDir);
  }

  // Catalog versions are optional: when omitted, plugin.json is the authoritative
  // source, so fetch the distribution to read its version (no files materialized).
  async version(
    source: PluginSource,
    projectRoot: string,
    catalogVersion: string | undefined
  ): Promise<string> {
    if (catalogVersion) return catalogVersion;
    const dist = await this.readDistribution(source, projectRoot);
    return dist.manifest.version;
  }

  translatorFor(
    tool: Parameters<typeof resolvePluginTranslator>[0],
    fs: FileReader & FileWriter
  ): PluginTranslator | null {
    return resolvePluginTranslator(tool, {
      fs,
      built: {
        homedir: nodeHomedir,
        ensureBuilt: this.sources.ensureBuilt,
        marketplaceRegistry: this.sources.marketplaceRegistry,
        translate: this.sources.translate,
        platform: nodePlatform(),
      },
    });
  }

  translate(command: PluginTranslationCommand): PluginTranslationResult {
    return this.sources.translate.execute(command);
  }
}
