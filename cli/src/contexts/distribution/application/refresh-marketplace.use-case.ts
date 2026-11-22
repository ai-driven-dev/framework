import { join, resolve } from "node:path";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { Logger } from "../../../shared/ports/logger.js";
import type { PluginCatalog } from "../contract/catalog.js";
import type { MarketplaceView } from "../contract/marketplace-view.js";
import {
  hasRelativePluginSources,
  parsePluginCatalog,
} from "../domain/catalog-parsers/claude-marketplace-catalog.js";
import { MARKETPLACE_CATALOG_RELATIVE } from "../domain/marketplace-cache-layout.js";
import type { MarketplaceCachePort } from "../ports/marketplace-cache.js";
import type { MarketplaceRegistry } from "../ports/marketplace-registry.js";
import type { ResolveMarketplace } from "./resolve-marketplace.use-case.js";

export interface RefreshMarketplaceRequest {
  projectRoot: string;
  name?: string;
  force?: boolean;
}

export interface RefreshMarketplaceDeps {
  readonly registry: MarketplaceRegistry;
  readonly resolveMarketplace: ResolveMarketplace;
  readonly cache: MarketplaceCachePort;
  readonly logger?: Logger;
  readonly fs?: FileReader;
}

/** Refreshing registered marketplace catalogs. */
export class RefreshMarketplace {
  private readonly registry: MarketplaceRegistry;
  private readonly resolveMarketplace: ResolveMarketplace;
  private readonly cache: MarketplaceCachePort;
  private readonly logger: Logger | undefined;
  private readonly fs: FileReader | undefined;

  constructor(deps: RefreshMarketplaceDeps) {
    this.registry = deps.registry;
    this.resolveMarketplace = deps.resolveMarketplace;
    this.cache = deps.cache;
    this.logger = deps.logger;
    this.fs = deps.fs;
  }

  /** The marketplaces a refresh covers, their cache cleared first when forced. */
  async targets(options: RefreshMarketplaceRequest): Promise<readonly MarketplaceView[]> {
    if (options.force) await this.cache.clear(options.name);
    const all = await this.registry.list(options.projectRoot);
    return options.name ? all.filter((m) => m.name === options.name) : all;
  }

  /** Fetches one marketplace again and stamps what it now carries. A failure travels. */
  async execute(projectRoot: string, m: MarketplaceView): Promise<void> {
    const cacheDir = this.resolveMarketplace.cacheDirOf(m, projectRoot);
    await this.warnIfStale(m.name, cacheDir);
    this.logger?.info(`Fetching marketplace '${m.name}'...`);
    const { catalog } = await this.resolveMarketplace.execute({
      marketplace: m,
      projectRoot,
      forceRefresh: true,
    });
    await this.registry.updateLastFetched(projectRoot, m, new Date().toISOString());
    if (catalog?.version !== undefined) {
      await this.registry.updateVersion(projectRoot, m, catalog.version);
    }
  }

  private async warnIfStale(name: string, cacheDir: string): Promise<void> {
    if (this.logger === undefined || this.fs === undefined) return;
    if (await this.isStaleCache(this.fs, cacheDir)) {
      this.logger.info(`Detected stale cache for '${name}' — re-fetching.`);
    }
  }

  private async isStaleCache(fs: FileReader, cacheDir: string): Promise<boolean> {
    try {
      const catalogFilePath = join(cacheDir, MARKETPLACE_CATALOG_RELATIVE);
      const raw: unknown = JSON.parse(await fs.readFile(catalogFilePath));
      const catalog = parsePluginCatalog(raw);
      if (!hasRelativePluginSources(catalog)) return false;
      return this.hasAnyMissingPluginPath(fs, catalog, cacheDir);
    } catch {
      return false;
    }
  }

  private async hasAnyMissingPluginPath(
    fs: FileReader,
    catalog: PluginCatalog,
    cacheDir: string
  ): Promise<boolean> {
    for (const entry of catalog.plugins) {
      if (entry.source.kind !== "local") continue;
      const resolvedPath = resolve(cacheDir, entry.source.path);
      if (!(await fs.fileExists(resolvedPath))) return true;
    }
    return false;
  }
}
