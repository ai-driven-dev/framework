import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { PluginSource } from "../../../../shared/domain/source.js";
import type { PluginDistributionReader } from "../../ports/plugin-distribution-reader.js";
import type { PluginFetcher } from "../../ports/plugin-fetcher.js";

export interface LoadPluginDistributionRequest {
  readonly source: PluginSource;
  readonly cacheDir: string;
  readonly forceRefresh?: boolean;
}

/** Brings a plugin's source to disk and reads the distribution found there. */
export class LoadPluginDistribution {
  constructor(
    private readonly fetcher: PluginFetcher,
    private readonly reader: PluginDistributionReader
  ) {}

  async execute(request: LoadPluginDistributionRequest): Promise<PluginDistribution> {
    const { source, cacheDir, forceRefresh } = request;
    const localPath = await this.fetcher.fetch(
      source,
      cacheDir,
      forceRefresh === undefined ? undefined : { forceRefresh }
    );
    return this.reader.read(localPath);
  }
}
