import { join } from "node:path";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { Logger } from "../../../shared/ports/logger.js";
import type { PluginCatalog } from "../contract/catalog.js";
import { hasRelativePluginSources, parsePluginCatalog } from "../domain/catalog.js";
import type { Marketplace } from "../domain/marketplace.js";
import type { PluginFetcher, PluginFetchOptions } from "../ports/plugin-fetcher.js";
import type { RawCatalogFetcher } from "../ports/raw-catalog-fetcher.js";

const CLAUDE_CATALOG_PATH = ".claude-plugin/marketplace.json";

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
      const catalog = await rawCatalogFetcher.fetchCatalog(marketplace.source, CLAUDE_CATALOG_PATH);
      await fs.writeFile(join(cacheDir, CLAUDE_CATALOG_PATH), catalog);
      return this.probeAndMaybeFallback(fs, marketplace, cacheDir, fetchOptions);
    }
    return this.pluginFetcher.fetch(marketplace.source, cacheDir, fetchOptions);
  }

  private async probeAndMaybeFallback(
    fs: FileReader & FileWriter,
    marketplace: FetchableMarketplace,
    cacheDir: string,
    fetchOptions?: PluginFetchOptions
  ): Promise<string> {
    try {
      const catalog = await this.loadRawCatalogSafely(fs, cacheDir);
      if (catalog === null || !hasRelativePluginSources(catalog)) return cacheDir;
      return this.runFallback(fs, marketplace, cacheDir, fetchOptions);
    } catch (err) {
      this.logger?.warn(
        `Probe failed for ${marketplace.name}, falling back to cache: ${String(err)}`
      );
      return cacheDir;
    }
  }

  private async loadRawCatalogSafely(
    fs: FileReader,
    cacheDir: string
  ): Promise<PluginCatalog | null> {
    try {
      const catalogFilePath = join(cacheDir, CLAUDE_CATALOG_PATH);
      const raw: unknown = JSON.parse(await fs.readFile(catalogFilePath));
      return parsePluginCatalog(raw);
    } catch (err) {
      this.logger?.warn(`Could not load raw catalog from ${cacheDir}: ${String(err)}`);
      return null;
    }
  }

  private async runFallback(
    fs: FileWriter,
    marketplace: FetchableMarketplace,
    cacheDir: string,
    fetchOptions?: PluginFetchOptions
  ): Promise<string> {
    await fs.deleteFile(join(cacheDir, CLAUDE_CATALOG_PATH));
    return this.pluginFetcher.fetch(marketplace.source, cacheDir, fetchOptions);
  }
}
