export interface StaleMarketplace {
  readonly name: string;
}

/** What one registered marketplace's catalog answered: the plugin names it lists, `null` when it
 * has no catalog to read, and the reason when reading it failed. */
export interface CatalogReading {
  readonly marketplace: string;
  readonly plugins: ReadonlySet<string> | null;
  readonly error?: unknown;
}

export interface MarketplaceCatalogs {
  readonly stale: readonly StaleMarketplace[];
  readonly readings: readonly CatalogReading[];
}
