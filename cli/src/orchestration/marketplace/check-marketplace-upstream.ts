import type { CheckMarketplaces } from "../../contexts/distribution/application/check-marketplaces.js";
import type { StaleMarketplace } from "../../contexts/distribution/contract/marketplace-catalogs.js";
import type { ListPluginSources } from "../../contexts/installation/application/marketplace/list-plugin-sources.js";
import type { PluginSource } from "../../contexts/installation/contract/plugin-sources.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";

export interface CheckMarketplaceUpstreamCommand {
  projectRoot: string;
  tools: ToolCatalog;
  staleMaxDays?: number;
}

/** An installed plugin its marketplace's catalog no longer lists. */
export type UpstreamRemoved = PluginSource;

export interface SkippedMarketplace {
  marketplace: string;
  error: string;
}

export interface CheckMarketplaceUpstreamResult {
  stale: readonly StaleMarketplace[];
  upstreamRemoved: readonly UpstreamRemoved[];
  skipped: readonly SkippedMarketplace[];
}

/** Holds each installed plugin against what its marketplace lists now: which marketplaces went
 * stale, which plugins the catalog dropped, and which catalogs could not be read. */
export class CheckMarketplaceUpstream {
  constructor(
    private readonly marketplaces: CheckMarketplaces,
    private readonly sources: ListPluginSources
  ) {}

  async execute(command: CheckMarketplaceUpstreamCommand): Promise<CheckMarketplaceUpstreamResult> {
    const { stale, readings } = await this.marketplaces.execute({
      projectRoot: command.projectRoot,
      staleMaxDays: command.staleMaxDays,
    });
    const installed = await this.sources.execute({ tools: command.tools });
    const upstreamRemoved: UpstreamRemoved[] = [];
    const skipped: SkippedMarketplace[] = [];
    for (const { marketplace, plugins, error } of readings) {
      if (plugins === null) {
        if (error !== undefined) skipped.push({ marketplace, error });
        continue;
      }
      for (const source of installed) {
        if (source.marketplace === marketplace && !plugins.has(source.plugin)) {
          upstreamRemoved.push({ marketplace, plugin: source.plugin, toolId: source.toolId });
        }
      }
    }
    return { stale, upstreamRemoved, skipped };
  }
}
