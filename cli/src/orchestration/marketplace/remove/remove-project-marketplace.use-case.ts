import type { FindMarketplaceToRemove } from "../../../contexts/distribution/application/remove/find-marketplace-to-remove.use-case.js";
import type { ForgetProjectMarketplace } from "../../../contexts/distribution/application/remove/forget-project-marketplace.use-case.js";
import type { MarketplaceRemovalResult } from "../../../contexts/distribution/contract/marketplace-removal.js";
import type { DetachPluginClaims } from "../../../contexts/installation/contract/records/plugin-claims.js";
import type { Scope } from "../../../shared/domain/scope.js";
import type { RemoveMarketplacePlugins } from "./remove-marketplace-plugins.use-case.js";
import type { WithdrawProjectMarketplaceFromHost } from "./withdraw-project-marketplace-from-host.use-case.js";

export interface RemoveProjectMarketplaceRequest {
  name: string;
  projectRoot: string;
  autoConfirm: boolean;
  scope?: Scope;
}

export interface RemoveProjectMarketplaceDeps {
  readonly hosts: Pick<WithdrawProjectMarketplaceFromHost, "execute">;
  readonly find: FindMarketplaceToRemove;
  readonly removePlugins: Pick<RemoveMarketplacePlugins, "execute">;
  readonly forget: Pick<ForgetProjectMarketplace, "execute">;
  readonly detachClaims: DetachPluginClaims;
}

/** Removes a project marketplace: finds it, proves the hosts that registered it will let go of it,
 * removes the plugins installed from it once the person agrees, withdraws it from those hosts,
 * forgets it and its built trees, then lets go of what those plugins claimed.
 *
 * The hosts are asked while the built tree and the registry entry still exist: a host's CLI
 * resolves the name against the one and the scope of the registration comes from the other. */
export class RemoveProjectMarketplace {
  constructor(private readonly deps: RemoveProjectMarketplaceDeps) {}

  async execute(command: RemoveProjectMarketplaceRequest): Promise<MarketplaceRemovalResult> {
    const { name, projectRoot } = command;
    const marketplace = await this.deps.find.execute({ name, projectRoot, scope: command.scope });
    const proven = await this.deps.hosts.execute({ kind: "prove", name, projectRoot });
    const removal = await this.deps.removePlugins.execute({
      name,
      projectRoot,
      autoConfirm: command.autoConfirm,
    });
    await this.deps.hosts.execute({ kind: "withdraw", proven });
    await this.deps.forget.execute({ projectRoot, marketplace });
    if (removal.claims !== undefined) await this.deps.detachClaims(projectRoot, removal.claims);
    return {
      marketplace,
      removedPluginCount: removal.removedCount,
      orphanCount: removal.orphanCount,
    };
  }
}
