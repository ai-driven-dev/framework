import type { MarketplaceCacheEntry } from "../../../src/domain/models/marketplace-cache-entry.js";
import type { MarketplaceCachePort } from "../../../src/domain/ports/marketplace-cache.js";

/**
 * Pure in-memory MarketplaceCachePort.
 */
export class InMemoryMarketplaceCache implements MarketplaceCachePort {
  private readonly entries = new Map<string, MarketplaceCacheEntry>();

  constructor(seed: MarketplaceCacheEntry[] = []) {
    for (const entry of seed) {
      this.entries.set(entry.name, entry);
    }
  }

  async list(): Promise<MarketplaceCacheEntry[]> {
    return [...this.entries.values()];
  }

  async clear(name?: string): Promise<void> {
    if (name !== undefined) {
      this.entries.delete(name);
    } else {
      this.entries.clear();
    }
  }

  // ── Inspection helpers ──────────────────────────────────────────────────────

  has(name: string): boolean {
    return this.entries.has(name);
  }
}
