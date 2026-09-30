import { join } from "node:path";
import { PLUGIN_CACHE_SUBDIR } from "../../../../kernel/paths.js";
import type { PluginFetcher } from "../../../distribution/domain/ports/plugin-fetcher.js";
import type { PluginDistribution } from "../../../translate/domain/plugin-distribution.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { PluginDistributionReader } from "../../domain/ports/plugin-distribution-reader.js";

export class UserPluginDistributionLoader {
  constructor(
    private readonly fetcher: PluginFetcher,
    private readonly reader: PluginDistributionReader
  ) {}

  async loadLatest(plugin: InstalledPlugin, projectRoot: string): Promise<PluginDistribution> {
    const localPath = await this.fetcher.fetch(
      plugin.source,
      join(projectRoot, PLUGIN_CACHE_SUBDIR),
      { forceRefresh: true }
    );
    return this.reader.read(localPath);
  }
}
