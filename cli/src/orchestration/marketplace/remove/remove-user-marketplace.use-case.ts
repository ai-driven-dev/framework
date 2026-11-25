import type { FindUserMarketplace } from "../../../contexts/distribution/application/remove/find-user-marketplace.use-case.js";
import type { RemoveMarketplace } from "../../../contexts/distribution/application/remove/remove-marketplace.use-case.js";
import type { MarketplaceRemovalResult } from "../../../contexts/distribution/contract/marketplace-removal.js";
import type { Scope } from "../../../shared/domain/scope.js";
import type { PurgeUserMarketplace } from "./purge-user-marketplace.use-case.js";

export interface RemoveUserMarketplaceRequest {
  name: string;
  projectRoot: string;
  autoConfirm: boolean;
  scope?: Scope;
}

export interface RemoveUserMarketplaceDeps {
  readonly find: Pick<FindUserMarketplace, "execute">;
  readonly purge: Pick<PurgeUserMarketplace, "execute">;
  readonly remove: Pick<RemoveMarketplace, "execute">;
}

/** Removes a user-scope marketplace: finds it, and under the machine lock proves it is unchanged,
 * purges what the machine holds for it, then forgets it. */
export class RemoveUserMarketplace {
  constructor(private readonly deps: RemoveUserMarketplaceDeps) {}

  async execute(command: RemoveUserMarketplaceRequest): Promise<MarketplaceRemovalResult> {
    const { name, projectRoot } = command;
    const marketplace = await this.deps.find.execute({ name, projectRoot });
    const removedPluginCount = await this.deps.purge.execute({
      marketplace: name,
      projectRoot,
      whileLocked: async () => {
        await this.deps.find.execute({
          name,
          projectRoot,
          unchangedSince: marketplace.fingerprint,
        });
      },
      forget: () => this.deps.remove.execute({ projectRoot, marketplace }),
    });
    return { marketplace, removedPluginCount, orphanCount: 0 };
  }
}
