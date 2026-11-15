import type { PluginCatalogEntry } from "../contract/catalog.js";
import type { Marketplace } from "../domain/marketplace.js";
import type { MarketplaceRegistry } from "../ports/marketplace-registry.js";
import type { ResolveMarketplace } from "./resolve-marketplace.js";

export interface SearchPluginsCommand {
  query: string;
  recommendedOnly: boolean;
  marketplace?: string;
  projectRoot: string;
}

export interface SearchHit {
  entry: PluginCatalogEntry;
  marketplace: Marketplace;
}

export interface SearchPluginsResult {
  hits: readonly SearchHit[];
}

export class SearchPlugins {
  constructor(
    private readonly registry: MarketplaceRegistry,
    private readonly resolveMarketplace: ResolveMarketplace
  ) {}

  async execute(options: SearchPluginsCommand): Promise<SearchPluginsResult> {
    const all = await this.registry.list(options.projectRoot);
    const filtered = options.marketplace ? all.filter((m) => m.name === options.marketplace) : all;
    const hits: SearchHit[] = [];
    for (const m of filtered) {
      hits.push(...(await this.searchOne(m, options)));
    }
    return { hits };
  }

  private async searchOne(m: Marketplace, options: SearchPluginsCommand): Promise<SearchHit[]> {
    const { catalog } = await this.resolveMarketplace.execute({
      marketplace: m,
      projectRoot: options.projectRoot,
    });
    if (!catalog) return [];
    return catalog.plugins
      .filter((entry) => this.matches(entry, options))
      .map((entry) => ({ entry, marketplace: m }));
  }

  private matches(entry: PluginCatalogEntry, options: SearchPluginsCommand): boolean {
    if (options.recommendedOnly && !entry.recommended) return false;
    const q = options.query.toLowerCase();
    if (q.length === 0) return true;
    const desc = entry.description?.toLowerCase() ?? "";
    return entry.name.toLowerCase().includes(q) || desc.includes(q);
  }
}
