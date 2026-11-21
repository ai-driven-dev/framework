import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { PluginSource } from "../../../../shared/domain/source.js";
import type { PluginFetcher, PluginFetchOptions } from "../../ports/marketplace-sources.js";
import type { PluginDistributionReader } from "../../ports/plugin/plugin-distribution-reader.js";

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
}
