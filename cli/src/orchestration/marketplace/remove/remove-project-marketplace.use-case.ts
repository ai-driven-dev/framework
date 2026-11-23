import type { FindMarketplaceToRemove } from "../../../contexts/distribution/application/remove/find-marketplace-to-remove.use-case.js";
import type { RemoveMarketplace } from "../../../contexts/distribution/application/remove/remove-marketplace.use-case.js";
import type { MarketplaceRemovalResult } from "../../../contexts/distribution/contract/marketplace-removal.js";
import type { DetachPluginClaims } from "../../../contexts/installation/contract/records/plugin-claims.js";
import type { Scope } from "../../../shared/domain/scope.js";
import type { RemoveMarketplacePlugins } from "./remove-marketplace-plugins.use-case.js";

export interface RemoveProjectMarketplaceRequest {
  name: string;
  projectRoot: string;
  autoConfirm: boolean;
  scope?: Scope;
}

export interface RemoveProjectMarketplaceDeps {
  readonly find: FindMarketplaceToRemove;
  readonly removePlugins: Pick<RemoveMarketplacePlugins, "execute">;
  readonly remove: RemoveMarketplace;
  readonly detachClaims: DetachPluginClaims;
}

/** Removes a project marketplace: finds it, removes the plugins installed from it once the person
 * agrees, forgets it, then lets go of what those plugins claimed. */
export class RemoveProjectMarketplace {
  constructor(private readonly deps: RemoveProjectMarketplaceDeps) {}

  async execute(command: RemoveProjectMarketplaceRequest): Promise<MarketplaceRemovalResult> {
    const { name, projectRoot } = command;
    const marketplace = await this.deps.find.execute({ name, projectRoot, scope: command.scope });
    const removal = await this.deps.removePlugins.execute({
      name,
      projectRoot,
      autoConfirm: command.autoConfirm,
    });
    await this.deps.remove.execute({ projectRoot, marketplace });
    if (removal.claims !== undefined) await this.deps.detachClaims(projectRoot, removal.claims);
    return {
      marketplace,
      removedPluginCount: removal.removedCount,
      orphanCount: removal.orphanCount,
    };
  }
}
