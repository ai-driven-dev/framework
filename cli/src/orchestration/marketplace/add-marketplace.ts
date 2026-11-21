import type {
  PrepareMarketplace,
  PrepareMarketplaceCommand,
  PrepareMarketplaceResult,
} from "../../contexts/distribution/application/add/prepare-marketplace.js";
import type { RecordMarketplace } from "../../contexts/distribution/application/add/record-marketplace.js";
import type { Prompter } from "../../shared/ports/prompter.js";
import { TrustDeniedError } from "../orchestration.error.js";
import type { RemoveRegisteredMarketplace } from "./remove-registered-marketplace.js";

export interface AddMarketplaceCommand extends Omit<PrepareMarketplaceCommand, "replace"> {
  /** Trusts the source without asking. */
  autoTrust: boolean;
  /** Removes the registered marketplace of the same name, with what was installed from it, first. */
  overwrite?: boolean;
}

export interface AddMarketplaceResult {
  marketplace: PrepareMarketplaceResult["marketplace"];
}

export interface AddMarketplaceDeps {
  readonly removeRegistered: Pick<RemoveRegisteredMarketplace, "execute">;
  readonly prepare: Pick<PrepareMarketplace, "execute">;
  readonly record: Pick<RecordMarketplace, "execute">;
  readonly prompter: Prompter;
}

/** Adds a marketplace. With `overwrite`, the registered one is removed first: removing deletes
 * installed plugin files, which distribution does not own. An untrusted source is asked about
 * before the marketplace is saved. */
export class AddMarketplace {
  constructor(private readonly deps: AddMarketplaceDeps) {}

  async execute(command: AddMarketplaceCommand): Promise<AddMarketplaceResult> {
    if (command.overwrite) {
      await this.deps.removeRegistered.execute({
        name: command.name,
        projectRoot: command.projectRoot,
      });
    }
    const { marketplace, trusted } = await this.deps.prepare.execute({
      ...command,
      replace: command.overwrite,
    });
    const trust = !trusted && (command.autoTrust || (await this.confirmTrust(command.name)));
    await this.deps.record.execute({ marketplace, projectRoot: command.projectRoot, trust });
    return { marketplace };
  }

  private async confirmTrust(name: string): Promise<true> {
    if (!(await this.deps.prompter.confirm(`Trust marketplace '${name}'?`))) {
      throw new TrustDeniedError(name);
    }
    return true;
  }
}
