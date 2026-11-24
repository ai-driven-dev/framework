import type { RemoveBuiltMarketplace } from "../../../contexts/distribution/application/remove/remove-built-marketplace.use-case.js";
import type { RemoveMarketplace } from "../../../contexts/distribution/application/remove/remove-marketplace.use-case.js";
import type { RemovableMarketplace } from "../../../contexts/distribution/contract/marketplace-removal.js";

export interface DropProjectMarketplaceRequest {
  projectRoot: string;
  marketplace: RemovableMarketplace;
}

/** Forgets a project marketplace: its registry entry, then the trees it was built into. */
export class DropProjectMarketplace {
  constructor(
    private readonly registry: Pick<RemoveMarketplace, "execute">,
    private readonly built: Pick<RemoveBuiltMarketplace, "execute">
  ) {}

  async execute(command: DropProjectMarketplaceRequest): Promise<void> {
    const { projectRoot, marketplace } = command;
    await this.registry.execute({ projectRoot, marketplace });
    await this.built.execute({ projectRoot, name: marketplace.name });
  }
}
