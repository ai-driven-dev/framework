import {
  InvalidMarketplaceNameError,
  MarketplaceNotFoundError,
} from "../../../../shared/domain/errors.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../contract/marketplace.js";
import type { FoundUserMarketplace } from "../../contract/marketplace-removal.js";
import type { MarketplaceRegistry } from "../../ports/marketplace-registry.js";

export interface FindUserMarketplaceCommand {
  name: string;
  projectRoot: string;
  /** The fingerprint an earlier find returned: the marketplace must still be the one it described. */
  unchangedSince?: string;
}

/** The user-scope marketplace a removal targets, or why it cannot be removed. */
export class FindUserMarketplace {
  constructor(private readonly registry: MarketplaceRegistry) {}

  async execute(command: FindUserMarketplaceCommand): Promise<FoundUserMarketplace> {
    if (command.name === FRAMEWORK_MARKETPLACE_NAME) {
      throw new InvalidMarketplaceNameError(
        `"${FRAMEWORK_MARKETPLACE_NAME}" is shared by every project on this machine and is removed by \`aidd clean --scope user\`, not marketplace remove.`
      );
    }
    const found = (await this.registry.list(command.projectRoot)).find(
      (entry) => entry.name === command.name && entry.scope === "user"
    );
    if (found === undefined) throw new MarketplaceNotFoundError(command.name);
    const fingerprint = JSON.stringify(found.source);
    if (command.unchangedSince !== undefined && command.unchangedSince !== fingerprint) {
      throw new Error(
        `User-scope marketplace '${found.name}' changed while waiting for the machine lock; retry against its current source.`
      );
    }
    return { name: found.name, scope: "user", fingerprint };
  }
}
