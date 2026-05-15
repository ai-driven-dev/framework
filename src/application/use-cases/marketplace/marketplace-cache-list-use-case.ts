import type { MarketplaceCacheEntry } from "../../../domain/models/marketplace-cache-entry.js";
import type { MarketplaceCachePort } from "../../../domain/ports/marketplace-cache.js";

export interface MarketplaceCacheListResult {
  entries: MarketplaceCacheEntry[];
}

export class MarketplaceCacheListUseCase {
  constructor(private readonly cachePort: MarketplaceCachePort) {}

  async execute(): Promise<MarketplaceCacheListResult> {
    const entries = await this.cachePort.list();
    return { entries };
  }
}
