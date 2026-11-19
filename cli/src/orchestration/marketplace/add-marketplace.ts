import type {
  AddMarketplaceResult,
  AddMarketplace as AddMarketplaceToRegistry,
  AddMarketplaceCommand as AddMarketplaceToRegistryCommand,
} from "../../contexts/distribution/application/add-marketplace.js";
import type { RemoveRegisteredMarketplace } from "./remove-registered-marketplace.js";

export interface AddMarketplaceCommand extends Omit<AddMarketplaceToRegistryCommand, "replace"> {
  /** Removes the registered marketplace of the same name, with what was installed from it, first. */
  overwrite?: boolean;
}

/** Adds a marketplace. With `overwrite`, the registered one is removed first: removing deletes
 * installed plugin files, which distribution does not own. */
export class AddMarketplace {
  constructor(
    private readonly removeRegistered: Pick<RemoveRegisteredMarketplace, "execute">,
    private readonly add: Pick<AddMarketplaceToRegistry, "execute">
  ) {}

  async execute(command: AddMarketplaceCommand): Promise<AddMarketplaceResult> {
    if (command.overwrite) {
      await this.removeRegistered.execute({ name: command.name, projectRoot: command.projectRoot });
    }
    return this.add.execute({ ...command, replace: command.overwrite });
  }
}
