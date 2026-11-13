import type { MarketplaceCachePort } from "../../../src/contexts/distribution/ports/marketplace-cache.js";

/** Pure in-memory MarketplaceCachePort: names only, since clearing is the whole port. */
export class InMemoryMarketplaceCache implements MarketplaceCachePort {
  private readonly names = new Set<string>();
  /** Every clear() argument in call order, so callers can assert whether and how it was cleared. */
  readonly clearCalls: (string | undefined)[] = [];

  constructor(seed: readonly string[] = []) {
    for (const name of seed) this.names.add(name);
  }

  async clear(name?: string): Promise<void> {
    this.clearCalls.push(name);
    if (name !== undefined) {
      this.names.delete(name);
    } else {
      this.names.clear();
    }
  }

  has(name: string): boolean {
    return this.names.has(name);
  }

  add(...names: string[]): void {
    for (const name of names) this.names.add(name);
  }

  list(): string[] {
    return [...this.names].sort();
  }
}
