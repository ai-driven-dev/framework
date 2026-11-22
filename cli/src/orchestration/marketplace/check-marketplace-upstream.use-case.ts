import type { CheckMarketplaces } from "../../contexts/distribution/application/check-marketplaces.use-case.js";
import type { StaleMarketplace } from "../../contexts/distribution/contract/marketplace-catalogs.js";
import type { MarketplaceView } from "../../contexts/distribution/contract/marketplace-view.js";
import type { ListPluginSources } from "../../contexts/installation/application/marketplace/list-plugin-sources.use-case.js";
import type { PluginSource } from "../../contexts/installation/contract/plugin-sources.js";

export interface CheckMarketplaceUpstreamRequest {
  projectRoot: string;
  staleMaxDays?: number;
}

/** An installed plugin its marketplace's catalog no longer lists. */
export type UpstreamRemoved = PluginSource;

export interface SkippedMarketplace {
  marketplace: string;
  error: unknown;
}

export interface CheckMarketplaceUpstreamResult {
  stale: readonly StaleMarketplace[];
  upstreamRemoved: readonly UpstreamRemoved[];
  skipped: readonly SkippedMarketplace[];
}

interface CatalogReading {
  readonly marketplace: string;
  readonly plugins: ReadonlySet<string> | null;
  readonly error?: unknown;
}

/** Holds each installed plugin against what its marketplace lists now: which marketplaces went
 * stale, which plugins the catalog dropped, and which catalogs could not be read. */
export class CheckMarketplaceUpstream {
  constructor(
    private readonly marketplaces: Pick<CheckMarketplaces, "execute" | "readPluginNames">,
    private readonly sources: Pick<ListPluginSources, "execute">
  ) {}

  async execute(command: CheckMarketplaceUpstreamRequest): Promise<CheckMarketplaceUpstreamResult> {
    const { stale, marketplaces } = await this.marketplaces.execute({
      projectRoot: command.projectRoot,
      staleMaxDays: command.staleMaxDays,
    });
    const installed = await this.sources.execute();
    const readings = await this.readEach(marketplaces, command.projectRoot);
    const skipped: SkippedMarketplace[] = readings.flatMap(({ marketplace, plugins, error }) =>
      plugins === null && error !== undefined ? [{ marketplace, error }] : []
    );
    const upstreamRemoved: UpstreamRemoved[] = readings.flatMap(({ marketplace, plugins }) =>
      plugins === null
        ? []
        : installed
            .filter((source) => source.marketplace === marketplace && !plugins.has(source.plugin))
            .map((source) => ({ marketplace, plugin: source.plugin, toolId: source.toolId }))
    );
    return { stale, upstreamRemoved, skipped };
  }

  // A catalog that cannot be read is skipped with its error: it must not stop the others.
  private async readEach(
    marketplaces: readonly MarketplaceView[],
    projectRoot: string
  ): Promise<CatalogReading[]> {
    const readings: CatalogReading[] = [];
    for (const marketplace of marketplaces) {
      readings.push(await this.readOne(marketplace, projectRoot));
    }
    return readings;
  }

  private async readOne(
    marketplace: MarketplaceView,
    projectRoot: string
  ): Promise<CatalogReading> {
    try {
      const plugins = await this.marketplaces.readPluginNames(marketplace, projectRoot);
      return { marketplace: marketplace.name, plugins };
    } catch (error) {
      return { marketplace: marketplace.name, plugins: null, error };
    }
  }
}
