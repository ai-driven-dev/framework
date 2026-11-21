import type { Scope } from "../../../../shared/domain/scope.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../contract/marketplace.js";
import type { RemovableMarketplace } from "../../contract/marketplace-removal.js";
import {
  MarketplaceNotFoundError,
  SharedMarketplaceRemovalError,
} from "../../domain/distribution.error.js";
import type { MarketplaceRegistry } from "../../ports/marketplace-registry.js";

export interface FindMarketplaceToRemoveCommand {
  name: string;
  projectRoot: string;
  scope?: Scope;
}

/** The project-scope marketplace a removal targets, or why it cannot be removed. */
export class FindMarketplaceToRemove {
  constructor(private readonly registry: MarketplaceRegistry) {}

  async execute(command: FindMarketplaceToRemoveCommand): Promise<RemovableMarketplace> {
    // Machine-scope, shared by every project on this machine: removing it here would orphan the
    // host's own registration for every other project, with no confirmation and no way back short
    // of `aidd setup` running again. It is removed with the framework itself, by `aidd clean`.
    if (command.name === FRAMEWORK_MARKETPLACE_NAME) {
      throw new SharedMarketplaceRemovalError(FRAMEWORK_MARKETPLACE_NAME, "project");
    }
    if (command.scope === "user")
      throw new Error("User-scope marketplace removal requires RemoveUserMarketplace.");
    const found = (await this.registry.list(command.projectRoot)).find(
      (m) => m.name === command.name && m.scope === "project"
    );
    if (!found) throw new MarketplaceNotFoundError(command.name);
    return { name: found.name, scope: found.scope };
  }
}
