import type {
  AddMarketplaceResult,
  AddMarketplace as AddMarketplaceToRegistry,
  AddMarketplaceCommand as AddMarketplaceToRegistryCommand,
} from "../../contexts/distribution/application/add-marketplace.js";
import type { ListMarketplaces } from "../../contexts/distribution/application/list-marketplaces.js";
import { assertNotReservedMarketplaceName } from "../../contexts/distribution/contract/marketplace.js";
import type { RemoveProjectMarketplace } from "./remove-project-marketplace.js";
import type { RemoveUserMarketplace } from "./remove-user-marketplace.js";

export interface AddMarketplaceCommand extends Omit<AddMarketplaceToRegistryCommand, "replace"> {
  /** Removes the registered marketplace of the same name, with what was installed from it, first. */
  overwrite?: boolean;
}

/** Adds a marketplace. With `overwrite`, the registered one is removed first: removing deletes
 * installed plugin files, which distribution does not own. */
export class AddMarketplace {
  constructor(
    private readonly marketplaces: Pick<ListMarketplaces, "execute">,
    private readonly removeProject: Pick<RemoveProjectMarketplace, "execute">,
    private readonly removeUser: Pick<RemoveUserMarketplace, "execute">,
    private readonly add: Pick<AddMarketplaceToRegistry, "execute">
  ) {}

  async execute(command: AddMarketplaceCommand): Promise<AddMarketplaceResult> {
    if (command.overwrite) await this.removeRegistered(command);
    return this.add.execute({ ...command, replace: command.overwrite });
  }

  private async removeRegistered(command: AddMarketplaceCommand): Promise<void> {
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
