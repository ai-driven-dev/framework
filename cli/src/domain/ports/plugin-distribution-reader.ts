import type { PluginDistribution } from "../models/plugin-distribution.js";

export interface PluginDistributionReader {
  read(pluginRoot: string): Promise<PluginDistribution>;
}
