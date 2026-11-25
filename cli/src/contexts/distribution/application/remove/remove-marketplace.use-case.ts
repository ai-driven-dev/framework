import type { RemovableMarketplace } from "../../contract/marketplace-removal.js";
import type { MarketplaceRegistry } from "../../ports/marketplace-registry.js";

export interface RemoveMarketplaceRequest {
  projectRoot: string;
  marketplace: RemovableMarketplace;
}

/** Forgets a registered marketplace. What was installed from it is not this context's to remove. */
export class RemoveMarketplace {
  constructor(private readonly registry: MarketplaceRegistry) {}

  async execute(command: RemoveMarketplaceRequest): Promise<void> {
    await this.registry.delete(
      command.projectRoot,
      command.marketplace.name,
      command.marketplace.scope
    );
  }
}
