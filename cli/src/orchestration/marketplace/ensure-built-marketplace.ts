import type { ResolveMarketplace } from "../../contexts/distribution/application/resolve-marketplace.js";
import type { CacheBuiltMarketplace } from "../../contexts/installation/application/marketplace/cache-built-marketplace.js";
import type {
  BuiltMarketplaceEnsurer,
  EnsureBuiltMarketplaceCommand,
  EnsureBuiltMarketplaceResult,
} from "../../contexts/installation/contract/built-marketplace.js";

/** Resolves the marketplace's source, then has the installation cache its build. */
export class EnsureBuiltMarketplace implements BuiltMarketplaceEnsurer {
  constructor(
    private readonly resolveMarketplace: Pick<ResolveMarketplace, "execute">,
    private readonly cache: Pick<CacheBuiltMarketplace, "execute">
  ) {}

  async execute(command: EnsureBuiltMarketplaceCommand): Promise<EnsureBuiltMarketplaceResult> {
    const resolved = await this.resolveMarketplace.execute({
      marketplace: command.marketplace,
      projectRoot: command.projectRoot,
      forceRefresh: command.forceRefresh,
    });
    return this.cache.execute(command, resolved);
  }
}
