import {
  InvalidMarketplaceNameError,
  MarketplaceNotFoundError,
} from "../../../../shared/domain/errors.js";
import type { MarketplaceScope } from "../../../../shared/domain/scope.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../contract/marketplace.js";
import type { RemovableMarketplace } from "../../contract/marketplace-removal.js";
import type { MarketplaceRegistry } from "../../ports/marketplace-registry.js";

export interface FindMarketplaceToRemoveCommand {
  name: string;
  projectRoot: string;
  scope?: MarketplaceScope;
}

/** The project-scope marketplace a removal targets, or why it cannot be removed. */
export class FindMarketplaceToRemove {
  constructor(private readonly registry: MarketplaceRegistry) {}

  async execute(command: FindMarketplaceToRemoveCommand): Promise<RemovableMarketplace> {
    // Machine-scope, shared by every project on this machine: removing it here would orphan the
    // host's own registration for every other project, with no confirmation and no way back short
    // of `aidd setup` running again. It is removed with the framework itself, by `aidd clean`.
    if (command.name === FRAMEWORK_MARKETPLACE_NAME) {
      throw new InvalidMarketplaceNameError(
        `"${FRAMEWORK_MARKETPLACE_NAME}" is shared by every project on this machine and is not removed with \`aidd marketplace remove\` — it is removed with the framework itself, by \`aidd clean\`, once machine scope lands there.`
      );
    }
    if (command.scope === "user")
      throw new Error("User-scope marketplace removal requires UserMarketplaceRemoveUseCase.");
    const found = (await this.registry.list(command.projectRoot)).find(
      (m) => m.name === command.name && m.scope === "project"
    );
    if (!found) throw new MarketplaceNotFoundError(command.name);
    return { name: found.name, scope: found.scope };
  }
}
