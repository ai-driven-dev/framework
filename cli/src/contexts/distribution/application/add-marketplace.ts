import {
  InvalidPluginManifestError,
  MarketplaceAlreadyRegisteredError,
  TrustDeniedError,
} from "../../../shared/domain/errors.js";
import type { MarketplaceScope } from "../../../shared/domain/scope.js";
import type { PluginSource } from "../../../shared/domain/source.js";
import type { Prompter } from "../../../shared/ports/prompter.js";
import { assertNotReservedMarketplaceName } from "../contract/marketplace.js";
import { Marketplace } from "../domain/marketplace.js";
import type { MarketplaceRegistry } from "../ports/marketplace-registry.js";
import type { MarketplaceTrustStore } from "../ports/marketplace-trust-store.js";
import type { ResolveMarketplace } from "./resolve-marketplace.js";

export interface AddMarketplaceCommand {
  source: PluginSource;
  name: string;
  scope: MarketplaceScope;
  projectRoot: string;
  autoTrust: boolean;
  /** Saves over the registered entry of the same name instead of refusing it. */
  replace?: boolean;
}

export interface AddMarketplaceResult {
  marketplace: Marketplace;
}

export class AddMarketplace {
  constructor(
    private readonly registry: MarketplaceRegistry,
    private readonly trustStore: MarketplaceTrustStore,
    private readonly resolveMarketplace: ResolveMarketplace,
    private readonly prompter: Prompter
  ) {}

  async execute(options: AddMarketplaceCommand): Promise<AddMarketplaceResult> {
    assertNotReservedMarketplaceName(options.name);
    if (!options.replace) await this.assertNotRegistered(options.projectRoot, options.name);
    const marketplace = Marketplace.create({
      name: options.name,
      source: options.source,
      scope: options.scope,
      addedAt: new Date().toISOString(),
    });
    const { localPath, catalog } = await this.resolveMarketplace.execute({
      marketplace,
      projectRoot: options.projectRoot,
    });
    if (catalog === null) {
      throw new InvalidPluginManifestError(`marketplace.json not found at "${localPath}"`);
    }
    await this.ensureTrust(options);
    await this.registry.save(options.projectRoot, marketplace);
    return { marketplace };
  }

  private async assertNotRegistered(projectRoot: string, name: string): Promise<void> {
    const existing = await this.registry.list(projectRoot);
    if (existing.some((m) => m.name === name)) throw new MarketplaceAlreadyRegisteredError(name);
  }

  private async ensureTrust(options: AddMarketplaceCommand): Promise<void> {
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
