import type { FindUserMarketplace } from "../../contexts/distribution/application/remove/find-user-marketplace.js";
import type { RemoveMarketplace } from "../../contexts/distribution/application/remove/remove-marketplace.js";
import type { MarketplaceRemovalResult } from "../../contexts/distribution/contract/marketplace-removal.js";
import type { PurgeMarketplacePlugins } from "../../contexts/installation/application/marketplace/purge-marketplace-plugins.js";
import type { Scope } from "../../shared/domain/scope.js";

export interface RemoveUserMarketplaceCommand {
  name: string;
  projectRoot: string;
  autoConfirm: boolean;
  scope?: Scope;
}

export interface RemoveUserMarketplaceDeps {
  readonly find: Pick<FindUserMarketplace, "execute">;
  readonly purge: Pick<PurgeMarketplacePlugins, "execute">;
  readonly remove: Pick<RemoveMarketplace, "execute">;
  readonly home: string;
}

/** Removes a user-scope marketplace: finds it, and under the machine lock proves it is unchanged,
 * purges what the machine holds for it, then forgets it. */
export class RemoveUserMarketplace {
  constructor(private readonly deps: RemoveUserMarketplaceDeps) {}

  async execute(command: RemoveUserMarketplaceCommand): Promise<MarketplaceRemovalResult> {
    const { name, projectRoot } = command;
    const marketplace = await this.deps.find.execute({ name, projectRoot });
    const removedPluginCount = await this.deps.purge.execute({
      marketplace: name,
      projectRoot,
      home: this.deps.home,
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
