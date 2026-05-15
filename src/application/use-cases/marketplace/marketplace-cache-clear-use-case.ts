import type { MarketplaceCachePort } from "../../../domain/ports/marketplace-cache.js";

export interface MarketplaceCacheClearOptions {
  name?: string;
  all?: boolean;
}

export interface MarketplaceCacheClearResult {
  cleared: string[];
}

export class MarketplaceCacheClearUseCase {
  constructor(private readonly cachePort: MarketplaceCachePort) {}

  async execute(options: MarketplaceCacheClearOptions): Promise<MarketplaceCacheClearResult> {
    this.validateOptions(options);
    if (options.all) {
      const entries = await this.cachePort.list();
      await this.cachePort.clear();
      return { cleared: entries.map((e) => e.name) };
    }
    if (options.name) {
      await this.cachePort.clear(options.name);
      return { cleared: [options.name] };
    }
    return { cleared: [] };
  }

  private validateOptions(options: MarketplaceCacheClearOptions): void {
    if (!options.name && !options.all) {
      throw new Error(
        "Ambiguous: provide a marketplace name or --all. In TTY mode, omit both to get an interactive prompt."
      );
    }
    if (options.name && options.all) {
      throw new Error("Cannot use --all together with a specific marketplace name.");
    }
  }
}
