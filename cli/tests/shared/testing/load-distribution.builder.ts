import { LoadPluginDistribution } from "../../../src/contexts/distribution/application/plugin-source/load-plugin-distribution.use-case.js";
import type { PluginDistributionReader as Reader } from "../../../src/contexts/distribution/ports/plugin-distribution-reader.js";
import type { PluginFetcher as Fetcher } from "../../../src/contexts/distribution/ports/plugin-fetcher.js";
import type { LoadPluginDistribution as LoadDistributionFn } from "../../../src/contexts/installation/ports/plugin/load-plugin-distribution.js";

/** The function installation takes to load a plugin's distribution, over a fetcher and a reader. */
export function loadDistributionOf(fetcher: Fetcher, reader: Reader): LoadDistributionFn {
  const load = new LoadPluginDistribution(fetcher, reader);
  return (source, cacheDir, options) => load.execute({ source, cacheDir, ...options });
}

/** What a reader of a plugin distribution looks like. */
export type PluginDistributionReader = Reader;

/** What a fetcher of a plugin source looks like. */
export type PluginFetcher = Fetcher;
