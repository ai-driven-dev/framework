import { InvalidPluginManifestError } from "../../../../shared/domain/errors/invalid-plugin-manifest-error.js";
import { MarketplaceAlreadyRegisteredError } from "../../../../shared/domain/errors/marketplace-already-registered-error.js";
import type { Scope } from "../../../../shared/domain/scope.js";
import type { PluginSource } from "../../../../shared/domain/source.js";
import { assertNotReservedMarketplaceName } from "../../contract/marketplace.js";
import { Marketplace } from "../../domain/marketplace.js";
import type { MarketplaceRegistry } from "../../ports/marketplace-registry.js";
import type { MarketplaceTrustStore } from "../../ports/marketplace-trust-store.js";
import type { ResolveMarketplace } from "../resolve-marketplace.js";

export interface PrepareMarketplaceCommand {
  source: PluginSource;
  name: string;
  scope: Scope;
  projectRoot: string;
  /** Accepts a name already registered, the caller having removed or kept it knowingly. */
  replace?: boolean;
}

export interface PrepareMarketplaceResult {
  marketplace: Marketplace;
  /** False when the source still needs a person's trust before the marketplace is recorded. */
  trusted: boolean;
}

/** Checks a marketplace can be added and fetches it, and reports whether its source is trusted. */
export class PrepareMarketplace {
  constructor(
    private readonly registry: MarketplaceRegistry,
    private readonly trustStore: MarketplaceTrustStore,
    private readonly resolveMarketplace: ResolveMarketplace
  ) {}

  async execute(command: PrepareMarketplaceCommand): Promise<PrepareMarketplaceResult> {
    assertNotReservedMarketplaceName(command.name);
    if (!command.replace) await this.assertNotRegistered(command.projectRoot, command.name);
    const marketplace = Marketplace.create({
      name: command.name,
      source: command.source,
      scope: command.scope,
      addedAt: new Date().toISOString(),
    });
    const { localPath, catalog } = await this.resolveMarketplace.execute({
      marketplace,
      projectRoot: command.projectRoot,
    });
    if (catalog === null) {
      throw new InvalidPluginManifestError(`marketplace.json not found at "${localPath}"`);
    }
    const trusted = await this.trustStore.isTrusted(command.projectRoot, command.source);
    return { marketplace, trusted };
  }

  private async assertNotRegistered(projectRoot: string, name: string): Promise<void> {
    const existing = await this.registry.list(projectRoot);
    if (existing.some((m) => m.name === name)) throw new MarketplaceAlreadyRegisteredError(name);
  }
}
