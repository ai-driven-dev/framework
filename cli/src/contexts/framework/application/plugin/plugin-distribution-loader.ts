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
    private readonly reader: PluginDistributionReader,
    /** A global install's fetches: it writes nothing in the project. */
    private readonly globalCacheDir?: () => string
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
    const cacheDir = this.globalCacheDir?.() ?? join(projectRoot, PLUGIN_CACHE_SUBDIR);
    return this.load(plugin.source, cacheDir, { forceRefresh: true });
  }
}
