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

export class FetchMarketplaceSource {
  constructor(pluginFetcher: PluginFetcher);
  /** A raw catalog fetcher comes with the files its catalog is written to. */
  constructor(
    pluginFetcher: PluginFetcher,
    rawCatalogFetcher: RawCatalogFetcher,
    fs: FileReader & FileWriter,
    logger?: Logger
  );
  constructor(
    private readonly pluginFetcher: PluginFetcher,
    private readonly rawCatalogFetcher?: RawCatalogFetcher,
    private readonly fs?: FileReader & FileWriter,
    private readonly logger?: Logger
  ) {}

  async execute(options: FetchMarketplaceSourceCommand): Promise<string> {
    const { marketplace, cacheDir, fetchOptions } = options;
    const { rawCatalogFetcher, fs } = this;
    if (
      marketplace.source.kind === "github" &&
      rawCatalogFetcher !== undefined &&
      fs !== undefined
    ) {
      const catalog = await rawCatalogFetcher.fetchCatalog(
        marketplace.source,
        MARKETPLACE_CATALOG_RELATIVE
      );
      await fs.writeFile(join(cacheDir, MARKETPLACE_CATALOG_RELATIVE), catalog);
      return this.probeAndMaybeFallback(fs, options);
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
