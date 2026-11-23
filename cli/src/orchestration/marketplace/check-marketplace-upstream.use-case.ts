import type { CheckMarketplaces } from "../../contexts/distribution/application/check-marketplaces.use-case.js";
import type { ResolveMarketplace } from "../../contexts/distribution/application/resolve-marketplace.use-case.js";
import type { StaleMarketplace } from "../../contexts/distribution/contract/marketplace-catalogs.js";
import type { MarketplaceView } from "../../contexts/distribution/contract/marketplace-view.js";
import type { ListPluginSources } from "../../contexts/installation/application/marketplace/list-plugin-sources.use-case.js";
import {
  type PluginSource,
  upstreamRemoved,
} from "../../contexts/installation/contract/plugin-sources.js";

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
    private readonly marketplaces: Pick<CheckMarketplaces, "execute">,
    private readonly resolveMarketplace: Pick<ResolveMarketplace, "execute">,
    private readonly sources: Pick<ListPluginSources, "execute">
  ) {}

  async execute(command: CheckMarketplaceUpstreamRequest): Promise<CheckMarketplaceUpstreamResult> {
    const { stale, marketplaces } = await this.marketplaces.execute({
      projectRoot: command.projectRoot,
      staleMaxDays: command.staleMaxDays,
    });
    const readings = await this.readEach(marketplaces, command.projectRoot);
    const installed = await this.sources.execute();
    const skipped: SkippedMarketplace[] = readings.flatMap(({ marketplace, plugins, error }) =>
      plugins === null && error !== undefined ? [{ marketplace, error }] : []
    );
    const removed: UpstreamRemoved[] = readings.flatMap(({ marketplace, plugins }) =>
      plugins === null ? [] : upstreamRemoved(installed, marketplace, plugins)
    );
    return { stale, upstreamRemoved: removed, skipped };
  }

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

  // @policy report-and-continue: a single unreadable catalog must not abort the
  // overall report. Errors are surfaced on the reading for the caller to report.
  private async readOne(
    marketplace: MarketplaceView,
    projectRoot: string
  ): Promise<CatalogReading> {
    try {
      const { catalog } = await this.resolveMarketplace.execute({ marketplace, projectRoot });
      const plugins = catalog === null ? null : new Set(catalog.plugins.map((p) => p.name));
      return { marketplace: marketplace.name, plugins };
    } catch (error) {
      return { marketplace: marketplace.name, plugins: null, error };
    }
  }
}
