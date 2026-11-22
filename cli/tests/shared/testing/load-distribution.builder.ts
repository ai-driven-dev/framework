import { LoadPluginDistribution } from "../../../src/contexts/distribution/application/plugin-source/load-plugin-distribution.use-case.js";
import type { PluginDistributionReader } from "../../../src/contexts/distribution/ports/plugin-distribution-reader.js";
import type { PluginFetcher } from "../../../src/contexts/distribution/ports/plugin-fetcher.js";
import type { LoadDistribution } from "../../../src/contexts/installation/ports/plugin/load-plugin-distribution.js";

/** The function installation takes to load a plugin's distribution, over a real fetcher and reader. */
export function loadDistributionOf(
  fetcher: PluginFetcher,
  reader: PluginDistributionReader
): LoadDistribution {
  const load = new LoadPluginDistribution(fetcher, reader);
  return (source, cacheDir, options) => load.execute({ source, cacheDir, ...options });
}
