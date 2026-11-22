import { STALE_MAX_DAYS_DEFAULT } from "../contract/marketplace.js";
import type { MarketplaceCatalogs } from "../contract/marketplace-catalogs.js";
import { isMarketplaceStale } from "../domain/marketplace.js";
import type { MarketplaceRegistry } from "../ports/marketplace-registry.js";
import type { ResolvableMarketplace, ResolveMarketplace } from "./resolve-marketplace.use-case.js";

export interface CheckMarketplacesRequest {
  projectRoot: string;
  staleMaxDays?: number;
}

/** Which registered marketplaces went stale, next to every one registered. */
export class CheckMarketplaces {
  constructor(
    private readonly registry: MarketplaceRegistry,
    private readonly resolveMarketplace: ResolveMarketplace
  ) {}

  async execute(command: CheckMarketplacesRequest): Promise<MarketplaceCatalogs> {
    const maxDays = command.staleMaxDays ?? STALE_MAX_DAYS_DEFAULT;
    const marketplaces = await this.registry.list(command.projectRoot);
    const now = Date.now();
    const stale = marketplaces.filter((m) => isMarketplaceStale(m, now, maxDays));
    return { stale, marketplaces };
  }

  /** The plugin names one marketplace's catalog lists today, `null` when it has none. An unreadable
   * catalog throws its own error. */
  async readPluginNames(
    marketplace: ResolvableMarketplace,
    projectRoot: string
  ): Promise<ReadonlySet<string> | null> {
    const { catalog } = await this.resolveMarketplace.execute({ marketplace, projectRoot });
    return catalog === null ? null : new Set(catalog.plugins.map((p) => p.name));
  }
}
