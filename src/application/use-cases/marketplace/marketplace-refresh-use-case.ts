import type { Marketplace } from "../../../domain/models/marketplace.js";
import { marketplaceCacheDir } from "../../../domain/models/paths.js";
import type { MarketplaceRegistry } from "../../../domain/ports/marketplace-registry.js";
import type { PluginCatalogRepository } from "../../../domain/ports/plugin-catalog-repository.js";
import type { PluginFetcher } from "../../../domain/ports/plugin-fetcher.js";

export interface MarketplaceRefreshOptions {
  projectRoot: string;
  name?: string;
}

export interface RefreshEntryResult {
  name: string;
  status: "ok" | "failed";
  error?: string;
}

export interface MarketplaceRefreshResult {
  results: readonly RefreshEntryResult[];
  failedCount: number;
}

export class MarketplaceRefreshUseCase {
  constructor(
    private readonly catalogRepo: PluginCatalogRepository,
    private readonly registry: MarketplaceRegistry,
    private readonly pluginFetcher: PluginFetcher
  ) {}

  async execute(options: MarketplaceRefreshOptions): Promise<MarketplaceRefreshResult> {
    const all = await this.registry.list(options.projectRoot);
    const targets = options.name ? all.filter((m) => m.name === options.name) : all;
    const results: RefreshEntryResult[] = [];
    for (const m of targets) {
      results.push(await this.refreshOne(options.projectRoot, m));
    }
    const failedCount = results.filter((r) => r.status === "failed").length;
    return { results, failedCount };
  }

  // @policy report-and-continue: a single failed marketplace must not abort the
  // batch refresh. Each failure is reported via the result, never thrown.
  private async refreshOne(projectRoot: string, m: Marketplace): Promise<RefreshEntryResult> {
    try {
      const cacheDir = marketplaceCacheDir(projectRoot, m.name);
      const localPath = await this.pluginFetcher.fetch(m.source, cacheDir, {
        forceRefresh: true,
      });
      await this.catalogRepo.load(localPath);
      await this.registry.updateLastFetched(projectRoot, m.name, m.scope, new Date().toISOString());
      return { name: m.name, status: "ok" };
    } catch (err) {
      return {
        name: m.name,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
