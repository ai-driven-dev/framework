import type { FindMarketplaceToRemove } from "../../contexts/distribution/application/remove/find-marketplace-to-remove.use-case.js";
import type { RemoveMarketplace } from "../../contexts/distribution/application/remove/remove-marketplace.use-case.js";
import type { MarketplaceRemovalResult } from "../../contexts/distribution/contract/marketplace-removal.js";
import type { RegistrationRecordRules } from "../../contexts/host-registration/contract/registration-record-rules.js";
import type { RemovePluginsFromMarketplace } from "../../contexts/installation/application/marketplace/remove-plugins-from-marketplace.use-case.js";
import type { DetachPluginClaims } from "../../contexts/installation/contract/plugin-claims.js";
import type { Scope } from "../../shared/domain/scope.js";
import { pluginRefRecords } from "../plugin/plugin-ref-records.js";
import type { Prompter } from "../ports/prompter.js";

export interface RemoveProjectMarketplaceRequest {
  name: string;
  projectRoot: string;
  autoConfirm: boolean;
  scope?: Scope;
}

export interface RemoveProjectMarketplaceDeps {
  readonly find: FindMarketplaceToRemove;
  readonly plugins: RemovePluginsFromMarketplace;
  readonly remove: RemoveMarketplace;
  readonly detachClaims: DetachPluginClaims;
  readonly prompter: Prompter;
  readonly records: Pick<RegistrationRecordRules, "refOf" | "withoutRef">;
}

/** Removes a project marketplace: finds it, removes the plugins installed from it once the person
 * agrees, forgets it, then lets go of what those plugins claimed. */
export class RemoveProjectMarketplace {
  constructor(private readonly deps: RemoveProjectMarketplaceDeps) {}

  async execute(command: RemoveProjectMarketplaceRequest): Promise<MarketplaceRemovalResult> {
    const { name, projectRoot } = command;
    const marketplace = await this.deps.find.execute({ name, projectRoot, scope: command.scope });
    const removal = await this.deps.plugins.execute({
      marketplace: name,
      projectRoot,
      confirm: (count) =>
        command.autoConfirm
          ? Promise.resolve(true)
          : this.deps.prompter.confirm(
              `Remove ${count} plugin(s) installed from this marketplace?`
            ),
      records: pluginRefRecords(this.deps.records),
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
