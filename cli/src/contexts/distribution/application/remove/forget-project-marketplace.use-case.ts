import { builtMarketplaceRoot } from "../../../../shared/domain/layout/aidd-layout.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { RemovableMarketplace } from "../../contract/marketplace-removal.js";
import type { MarketplaceRegistry } from "../../ports/marketplace-registry.js";

export interface ForgetProjectMarketplaceRequest {
  projectRoot: string;
  marketplace: RemovableMarketplace;
}

/** Forgets a project marketplace: its registry entry, then the trees it was built into. */
export class ForgetProjectMarketplace {
  constructor(
    private readonly registry: MarketplaceRegistry,
    private readonly fs: Pick<FileWriter, "deleteDirectory">
  ) {}

  async execute({ projectRoot, marketplace }: ForgetProjectMarketplaceRequest): Promise<void> {
    await this.registry.delete(projectRoot, marketplace.name, marketplace.scope);
    await this.fs.deleteDirectory(builtMarketplaceRoot(projectRoot, marketplace.name));
  }
}
