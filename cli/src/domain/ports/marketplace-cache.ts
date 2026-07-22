import type { MarketplaceCacheEntry } from "../models/marketplace-cache-entry.js";

export interface MarketplaceCachePort {
  list(): Promise<MarketplaceCacheEntry[]>;
  clear(name?: string): Promise<void>;
}
