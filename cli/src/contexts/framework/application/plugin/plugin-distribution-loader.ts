import { join } from "node:path";
import { PLUGIN_CACHE_SUBDIR } from "../../../../kernel/paths.js";
import type { PluginSource } from "../../../../kernel/source.js";
import type {
  PluginFetcher,
  PluginFetchOptions,
} from "../../../distribution/domain/ports/plugin-fetcher.js";
import type { PluginDistribution } from "../../../translate/domain/plugin-distribution.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { PluginDistributionReader } from "../../domain/ports/plugin-distribution-reader.js";

export class PluginDistributionLoader {
  constructor(
    private readonly fetcher: PluginFetcher,
    private readonly reader: PluginDistributionReader
  ) {}

  async load(
    source: PluginSource,
    cacheDir: string,
    options?: PluginFetchOptions
  ): Promise<PluginDistribution> {
    const localPath = await this.fetcher.fetch(source, cacheDir, options);
    return this.reader.read(localPath);
  }

  loadLatest(plugin: InstalledPlugin, projectRoot: string): Promise<PluginDistribution> {
    return this.load(plugin.source, join(projectRoot, PLUGIN_CACHE_SUBDIR), { forceRefresh: true });
  }
}
