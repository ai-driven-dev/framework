import type { ResolveMarketplace } from "../../contexts/distribution/application/resolve-marketplace.js";
import type {
  BuiltMarketplaceEnsurer,
  CacheBuiltMarketplace,
  EnsureBuiltMarketplaceCommand,
  EnsureBuiltMarketplaceResult,
} from "../../contexts/installation/application/shared/ensure-built-marketplace.js";

/** What the ensurer is called with in practice: the registry hands over registered marketplaces,
 * which is what the resolver reads. The port types them by the fields an installation needs. */
type RegisteredMarketplaceCommand = EnsureBuiltMarketplaceCommand & {
  readonly marketplace: Parameters<ResolveMarketplace["execute"]>[0]["marketplace"];
};

/** Resolves the marketplace's source, then has the installation cache its build. */
export class EnsureBuiltMarketplace implements BuiltMarketplaceEnsurer {
  constructor(
    private readonly resolveMarketplace: Pick<ResolveMarketplace, "execute">,
    private readonly cache: Pick<CacheBuiltMarketplace, "execute">
  ) {}

  async execute(command: RegisteredMarketplaceCommand): Promise<EnsureBuiltMarketplaceResult> {
    const resolved = await this.resolveMarketplace.execute({
      marketplace: command.marketplace,
      projectRoot: command.projectRoot,
      forceRefresh: command.forceRefresh,
    });
    return this.cache.execute(command, resolved);
  }
}
