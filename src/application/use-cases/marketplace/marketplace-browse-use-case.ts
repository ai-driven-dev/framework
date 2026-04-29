import { join } from "node:path";
import {
  InvalidPluginManifestError,
  MarketplaceNotFoundError,
  OfflineError,
} from "../../../domain/errors.js";
import type { Marketplace } from "../../../domain/models/marketplace.js";
import { marketplaceCacheDir } from "../../../domain/models/paths.js";
import type { PluginCatalog } from "../../../domain/models/plugin-catalog.js";
import type { MarketplaceRegistry } from "../../../domain/ports/marketplace-registry.js";
import type { PluginCatalogRepository } from "../../../domain/ports/plugin-catalog-repository.js";
import type { PluginFetcher } from "../../../domain/ports/plugin-fetcher.js";
import type { Prompter } from "../../../domain/ports/prompter.js";

export interface MarketplaceBrowseOptions {
  name: string;
  projectRoot: string;
  useCachedOnFailure: boolean;
}

export interface MarketplaceBrowseResult {
  marketplace: Marketplace;
  catalog: PluginCatalog;
  fromCache: boolean;
}

export class MarketplaceBrowseUseCase {
  constructor(
    private readonly catalogRepo: PluginCatalogRepository,
    private readonly registry: MarketplaceRegistry,
    private readonly pluginFetcher: PluginFetcher,
    private readonly prompter: Prompter
  ) {}

  async execute(options: MarketplaceBrowseOptions): Promise<MarketplaceBrowseResult> {
    const marketplace = await this.findOrThrow(options.projectRoot, options.name);
    const cacheDir = marketplaceCacheDir(options.projectRoot, marketplace.name);
    return this.browseWithFallback(marketplace, cacheDir, options.useCachedOnFailure);
  }

  // @policy offline-fallback: try fresh fetch first; on failure, prompt to use
  // cached catalog or surface OfflineError. The catch implements the policy.
  private async browseWithFallback(
    marketplace: Marketplace,
    cacheDir: string,
    useCachedOnFailure: boolean
  ): Promise<MarketplaceBrowseResult> {
    try {
      const localPath = await this.pluginFetcher.fetch(marketplace.source, cacheDir, {
        forceRefresh: true,
      });
      const catalog = await this.requireCatalog(localPath);
      return { marketplace, catalog, fromCache: false };
    } catch (err) {
      return this.fallbackToCache(marketplace, cacheDir, useCachedOnFailure, err);
    }
  }

  private async fallbackToCache(
    marketplace: Marketplace,
    cacheDir: string,
    autoUseCache: boolean,
    originalError: unknown
  ): Promise<MarketplaceBrowseResult> {
    const useCache =
      autoUseCache || (await this.prompter.confirm("Failed to fetch. Use cached catalog?"));
    if (!useCache) {
      const detail = originalError instanceof Error ? originalError.message : String(originalError);
      throw new OfflineError(detail);
    }
    const localPath = await this.pluginFetcher.fetch(marketplace.source, cacheDir);
    const catalog = await this.requireCatalog(localPath);
    return { marketplace, catalog, fromCache: true };
  }

  private async findOrThrow(projectRoot: string, name: string): Promise<Marketplace> {
    const list = await this.registry.list(projectRoot);
    const found = list.find((m) => m.name === name);
    if (!found) throw new MarketplaceNotFoundError(name);
    return found;
  }

  private async requireCatalog(localPath: string): Promise<PluginCatalog> {
    const catalog = await this.catalogRepo.load(localPath);
    if (catalog === null) {
      throw new InvalidPluginManifestError(`marketplace.json not found at "${localPath}"`);
    }
    return catalog;
  }
}
