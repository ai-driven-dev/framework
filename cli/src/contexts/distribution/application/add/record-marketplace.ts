import type { Marketplace } from "../../domain/marketplace.js";
import type { MarketplaceRegistry } from "../../ports/marketplace-registry.js";
import type { MarketplaceTrustStore } from "../../ports/marketplace-trust-store.js";

export interface RecordMarketplaceCommand {
  marketplace: Marketplace;
  projectRoot: string;
  /** Trusts the marketplace's source before saving it. */
  trust: boolean;
}

/** Saves a prepared marketplace, trusting its source first when asked. */
export class RecordMarketplace {
  constructor(
    private readonly registry: MarketplaceRegistry,
    private readonly trustStore: MarketplaceTrustStore
  ) {}

  async execute(command: RecordMarketplaceCommand): Promise<void> {
    const { marketplace, projectRoot } = command;
    if (command.trust) await this.trustStore.trust(projectRoot, marketplace.source);
    await this.registry.save(projectRoot, marketplace);
  }
}
