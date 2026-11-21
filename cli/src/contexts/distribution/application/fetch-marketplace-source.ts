import { join } from "node:path";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { Logger } from "../../../shared/ports/logger.js";
import type { PluginCatalog } from "../contract/catalog.js";
import { hasRelativePluginSources, parsePluginCatalog } from "../domain/catalog.js";
import type { Marketplace } from "../domain/marketplace.js";
import { MARKETPLACE_CATALOG_RELATIVE } from "../domain/marketplace-cache-layout.js";
import type { PluginFetcher, PluginFetchOptions } from "../ports/plugin-fetcher.js";
import type { RawCatalogFetcher } from "../ports/raw-catalog-fetcher.js";

/** What fetching reads of a marketplace: its name and where it is fetched from. */
type FetchableMarketplace = Pick<Marketplace, "name" | "source">;

export interface FetchMarketplaceSourceCommand {
  marketplace: FetchableMarketplace;
  cacheDir: string;
  fetchOptions?: PluginFetchOptions;
}

export interface FetchMarketplaceSourceDeps {
  readonly pluginFetcher: PluginFetcher;
  /** A raw catalog fetcher comes with the files its catalog is written to. */
  readonly rawCatalog?: { fetcher: RawCatalogFetcher; fs: FileReader & FileWriter };
  readonly logger?: Logger;
}

export class FetchMarketplaceSource {
  private readonly pluginFetcher: PluginFetcher;
  private readonly rawCatalog: FetchMarketplaceSourceDeps["rawCatalog"];
  private readonly logger: Logger | undefined;

  constructor(deps: FetchMarketplaceSourceDeps) {
    this.pluginFetcher = deps.pluginFetcher;
    this.rawCatalog = deps.rawCatalog;
    this.logger = deps.logger;
  }

  async execute(options: FetchMarketplaceSourceCommand): Promise<string> {
    const { marketplace, cacheDir, fetchOptions } = options;
    const { rawCatalog } = this;
    if (marketplace.source.kind === "github" && rawCatalog !== undefined) {
      const catalog = await rawCatalog.fetcher.fetchCatalog(
        marketplace.source,
        MARKETPLACE_CATALOG_RELATIVE
      );
      await rawCatalog.fs.writeFile(join(cacheDir, MARKETPLACE_CATALOG_RELATIVE), catalog);
      return this.probeAndMaybeFallback(rawCatalog.fs, options);
    }
    return this.pluginFetcher.fetch(marketplace.source, cacheDir, fetchOptions);
  }

  private async probeAndMaybeFallback(
    fs: FileReader & FileWriter,
    command: FetchMarketplaceSourceCommand
  ): Promise<string> {
    const { marketplace, cacheDir } = command;
    try {
      const catalog = await this.loadRawCatalogSafely(fs, cacheDir);
      if (catalog === null || !hasRelativePluginSources(catalog)) return cacheDir;
      return this.runFallback(fs, command);
    } catch (err) {
      this.logger?.warn(`Probe failed for ${marketplace.name}, falling back to cache: `, err);
      return cacheDir;
    }
  }

  private async loadRawCatalogSafely(
    fs: FileReader,
    cacheDir: string
  ): Promise<PluginCatalog | null> {
    try {
      const catalogFilePath = join(cacheDir, MARKETPLACE_CATALOG_RELATIVE);
      const raw: unknown = JSON.parse(await fs.readFile(catalogFilePath));
      return parsePluginCatalog(raw);
    } catch (err) {
      this.logger?.warn(`Could not load raw catalog from ${cacheDir}: `, err);
      return null;
    }
  }

  private async runFallback(
    fs: FileWriter,
    { marketplace, cacheDir, fetchOptions }: FetchMarketplaceSourceCommand
  ): Promise<string> {
    await fs.deleteFile(join(cacheDir, MARKETPLACE_CATALOG_RELATIVE));
    return this.pluginFetcher.fetch(marketplace.source, cacheDir, fetchOptions);
  }
}
