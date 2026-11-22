import { join } from "node:path";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { Logger } from "../../../shared/ports/logger.js";
import {
  hasRelativePluginSources,
  tryParsePluginCatalog,
} from "../domain/catalog-parsers/claude-marketplace-catalog.js";
import type { Marketplace } from "../domain/marketplace.js";
import { MARKETPLACE_CATALOG_RELATIVE } from "../domain/marketplace-cache-layout.js";
import type { PluginFetcher, PluginFetchOptions } from "../ports/plugin-fetcher.js";
import type { RawCatalogFetcher } from "../ports/raw-catalog-fetcher.js";

/** What fetching reads of a marketplace: its name and where it is fetched from. */
type FetchableMarketplace = Pick<Marketplace, "name" | "source">;

export interface FetchMarketplaceSourceRequest {
  marketplace: FetchableMarketplace;
  cacheDir: string;
  fetchOptions?: PluginFetchOptions;
}

export interface FetchMarketplaceSourceDeps {
  readonly pluginFetcher: PluginFetcher;
  /** A raw catalog fetcher comes with the files its catalog is written to. */
  readonly rawCatalog: { fetcher: RawCatalogFetcher; fs: FileWriter };
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

  async execute(options: FetchMarketplaceSourceRequest): Promise<string> {
    const { marketplace, cacheDir, fetchOptions } = options;
    const { rawCatalog } = this;
    if (marketplace.source.kind === "github") {
      const catalog = await rawCatalog.fetcher.fetchCatalog(
        marketplace.source,
        MARKETPLACE_CATALOG_RELATIVE
      );
      await rawCatalog.fs.writeFile(join(cacheDir, MARKETPLACE_CATALOG_RELATIVE), catalog);
      return this.probeAndMaybeFallback(rawCatalog.fs, options, catalog);
    }
    return this.pluginFetcher.fetch(marketplace.source, cacheDir, fetchOptions);
  }

  private async probeAndMaybeFallback(
    fs: FileWriter,
    command: FetchMarketplaceSourceRequest,
    catalogBody: string
  ): Promise<string> {
    const { cacheDir } = command;
    const parsed = tryParsePluginCatalog(catalogBody);
    if (!parsed.ok) {
      this.logger?.warn(`Could not load raw catalog from ${cacheDir}: `, parsed.error);
      return cacheDir;
    }
    return hasRelativePluginSources(parsed.catalog) ? this.runFallback(fs, command) : cacheDir;
  }

  private async runFallback(
    fs: FileWriter,
    { marketplace, cacheDir, fetchOptions }: FetchMarketplaceSourceRequest
  ): Promise<string> {
    await fs.deleteFile(join(cacheDir, MARKETPLACE_CATALOG_RELATIVE));
    return this.pluginFetcher.fetch(marketplace.source, cacheDir, fetchOptions);
  }
}
