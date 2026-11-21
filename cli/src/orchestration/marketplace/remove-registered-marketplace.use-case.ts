import type { ListMarketplaces } from "../../contexts/distribution/application/list-marketplaces.use-case.js";
import { assertNotReservedMarketplaceName } from "../../contexts/distribution/contract/marketplace.js";
import type { RemoveProjectMarketplace } from "./remove-project-marketplace.use-case.js";
import type { RemoveUserMarketplace } from "./remove-user-marketplace.use-case.js";

export interface RemoveRegisteredMarketplaceRequest {
  name: string;
  projectRoot: string;
}

/** Removes the marketplace registered under a name, with what was installed from it, in the scope
 * it was found in. Nothing registered, nothing removed. */
export class RemoveRegisteredMarketplace {
  constructor(
    private readonly marketplaces: Pick<ListMarketplaces, "execute">,
    private readonly removeProject: Pick<RemoveProjectMarketplace, "execute">,
    private readonly removeUser: Pick<RemoveUserMarketplace, "execute">
  ) {}

  async execute(command: RemoveRegisteredMarketplaceRequest): Promise<void> {
    const { name, projectRoot } = command;
    assertNotReservedMarketplaceName(name);
    const { marketplaces } = await this.marketplaces.execute({ projectRoot });
    const registered = marketplaces.find((m) => m.name === name);
    if (registered === undefined) return;
    const removal = { name, projectRoot, autoConfirm: true, scope: registered.scope };
    await (registered.scope === "user"
      ? this.removeUser.execute(removal)
      : this.removeProject.execute(removal));
  }
}
