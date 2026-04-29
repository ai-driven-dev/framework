import {
  InvalidMarketplaceNameError,
  InvalidPluginManifestError,
  MarketplaceAlreadyRegisteredError,
  TrustDeniedError,
} from "../../../domain/errors.js";
import {
  FRAMEWORK_MARKETPLACE_NAME,
  Marketplace,
  type MarketplaceScope,
} from "../../../domain/models/marketplace.js";
import { marketplaceCacheDir } from "../../../domain/models/paths.js";
import type { PluginSource } from "../../../domain/models/plugin-source.js";
import type { MarketplaceRegistry } from "../../../domain/ports/marketplace-registry.js";
import type { MarketplaceTrustStore } from "../../../domain/ports/marketplace-trust-store.js";
import type { PluginCatalogRepository } from "../../../domain/ports/plugin-catalog-repository.js";
import type { PluginFetcher } from "../../../domain/ports/plugin-fetcher.js";
import type { Prompter } from "../../../domain/ports/prompter.js";
import type { MarketplaceRemoveUseCase } from "./marketplace-remove-use-case.js";

export interface MarketplaceAddOptions {
  source: PluginSource;
  name: string;
  scope: MarketplaceScope;
  projectRoot: string;
  autoTrust: boolean;
  overwrite?: boolean;
}

export interface MarketplaceAddResult {
  marketplace: Marketplace;
}

export class MarketplaceAddUseCase {
  constructor(
    private readonly catalogRepo: PluginCatalogRepository,
    private readonly registry: MarketplaceRegistry,
    private readonly trustStore: MarketplaceTrustStore,
    private readonly pluginFetcher: PluginFetcher,
    private readonly prompter: Prompter,
    private readonly removeUseCase: MarketplaceRemoveUseCase
  ) {}

  async execute(options: MarketplaceAddOptions): Promise<MarketplaceAddResult> {
    if (options.name === FRAMEWORK_MARKETPLACE_NAME) {
      throw new InvalidMarketplaceNameError(
        `"${FRAMEWORK_MARKETPLACE_NAME}" is reserved for the framework auto-register entry`
      );
    }
    await this.assertNotRegistered(options.projectRoot, options.name, options.overwrite ?? false);
    const localPath = await this.fetchSource(options.projectRoot, options.name, options.source);
    const catalog = await this.catalogRepo.load(localPath);
    if (catalog === null) {
      throw new InvalidPluginManifestError(`marketplace.json not found at "${localPath}"`);
    }
    await this.ensureTrust(options);
    const marketplace = Marketplace.create({
      name: options.name,
      source: options.source,
      scope: options.scope,
      addedAt: new Date().toISOString(),
    });
    await this.registry.save(options.projectRoot, marketplace);
    return { marketplace };
  }

  private async assertNotRegistered(
    projectRoot: string,
    name: string,
    overwrite: boolean
  ): Promise<void> {
    const existing = await this.registry.list(projectRoot);
    const found = existing.find((m) => m.name === name);
    if (!found) return;
    if (!overwrite) throw new MarketplaceAlreadyRegisteredError(name);
    await this.removeUseCase.execute({ name, projectRoot, autoConfirm: true });
  }

  private async fetchSource(
    projectRoot: string,
    name: string,
    source: PluginSource
  ): Promise<string> {
    const cacheDir = marketplaceCacheDir(projectRoot, name);
    return this.pluginFetcher.fetch(source, cacheDir);
  }

  private async ensureTrust(options: MarketplaceAddOptions): Promise<void> {
    if (await this.trustStore.isTrusted(options.projectRoot, options.source)) return;
    if (options.autoTrust) {
      await this.trustStore.trust(options.projectRoot, options.source);
      return;
    }
    const confirmed = await this.prompter.confirm(`Trust marketplace '${options.name}'?`);
    if (!confirmed) throw new TrustDeniedError(options.name);
    await this.trustStore.trust(options.projectRoot, options.source);
  }
}
