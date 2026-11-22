import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { PluginSource } from "../../../../shared/domain/source.js";

/** Brings a plugin's source to disk and reads the distribution found there. The distribution
 * context owns the fetch and the read; the composition hands over a function of this shape. */
export type LoadDistribution = (
  source: PluginSource,
  cacheDir: string,
  options?: { forceRefresh?: boolean }
) => Promise<PluginDistribution>;
