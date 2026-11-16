import { STALE_MAX_DAYS_DEFAULT } from "../contract/marketplace.js";
import type { CatalogReading, MarketplaceCatalogs } from "../contract/marketplace-catalogs.js";
import { isMarketplaceStale, type Marketplace } from "../domain/marketplace.js";
import type { MarketplaceRegistry } from "../ports/marketplace-registry.js";
import type { ResolveMarketplace } from "./resolve-marketplace.js";

export interface CheckMarketplacesCommand {
  projectRoot: string;
  staleMaxDays?: number;
}

/** Which registered marketplaces went stale, and what each one's catalog lists today. */
export class CheckMarketplaces {
  constructor(
    private readonly registry: MarketplaceRegistry,
    private readonly resolveMarketplace: ResolveMarketplace
  ) {}

  async execute(command: CheckMarketplacesCommand): Promise<MarketplaceCatalogs> {
    const maxDays = command.staleMaxDays ?? STALE_MAX_DAYS_DEFAULT;
    const marketplaces = await this.registry.list(command.projectRoot);
    const now = Date.now();
    const stale = marketplaces.filter((m) => isMarketplaceStale(m, now, maxDays));
    const readings: CatalogReading[] = [];
    for (const marketplace of marketplaces) {
      readings.push(await this.readCatalog(marketplace, command.projectRoot));
    }
    return { stale, readings };
  }

  // @policy report-and-continue: a single unreadable catalog must not abort the
  // overall report. Errors are surfaced on the reading for the caller to report.
  private async readCatalog(m: Marketplace, projectRoot: string): Promise<CatalogReading> {
    try {
      const { catalog } = await this.resolveMarketplace.execute({ marketplace: m, projectRoot });
      if (!catalog) return { marketplace: m.name, plugins: null };
      return { marketplace: m.name, plugins: new Set(catalog.plugins.map((p) => p.name)) };
    } catch (err) {
      return {
        marketplace: m.name,
        plugins: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
