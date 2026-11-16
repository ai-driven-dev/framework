import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";

export interface PluginDistributionReader {
  read(pluginRoot: string): Promise<PluginDistribution>;
}
