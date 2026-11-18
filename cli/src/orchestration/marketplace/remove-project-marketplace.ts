import type { FindMarketplaceToRemove } from "../../contexts/distribution/application/remove/find-marketplace-to-remove.js";
import type { RemoveMarketplace } from "../../contexts/distribution/application/remove/remove-marketplace.js";
import type { MarketplaceRemovalResult } from "../../contexts/distribution/contract/marketplace-removal.js";
import type { RemovePluginsFromMarketplace } from "../../contexts/installation/application/marketplace/remove-plugins-from-marketplace.js";
import type { DetachPluginClaims } from "../../contexts/installation/contract/plugin-claims.js";
import type { MarketplaceScope } from "../../shared/domain/scope.js";
import type { Prompter } from "../../shared/ports/prompter.js";

export interface RemoveProjectMarketplaceCommand {
  name: string;
  projectRoot: string;
  autoConfirm: boolean;
  scope?: MarketplaceScope;
}

/** Removes a project marketplace: finds it, removes the plugins installed from it once the person
 * agrees, forgets it, then lets go of what those plugins claimed. */
export class RemoveProjectMarketplace {
  constructor(
    private readonly find: FindMarketplaceToRemove,
    private readonly plugins: RemovePluginsFromMarketplace,
    private readonly remove: RemoveMarketplace,
    private readonly detachClaims: DetachPluginClaims,
    private readonly prompter: Prompter
  ) {}

  async execute(command: RemoveProjectMarketplaceCommand): Promise<MarketplaceRemovalResult> {
    const { name, projectRoot } = command;
    const marketplace = await this.find.execute({ name, projectRoot, scope: command.scope });
    const removal = await this.plugins.execute({
      marketplace: name,
      projectRoot,
      confirm: (count) =>
        command.autoConfirm
          ? Promise.resolve(true)
          : this.prompter.confirm(`Remove ${count} plugin(s) installed from this marketplace?`),
    });
    await this.remove.execute({ projectRoot, marketplace });
    if (removal.claims !== undefined) await this.detachClaims(projectRoot, removal.claims);
    return {
      marketplace,
      removedPluginCount: removal.removedCount,
      orphanCount: removal.orphanCount,
    };
  }
}
