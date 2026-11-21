import type {
  PrepareMarketplace,
  PrepareMarketplaceCommand,
  PrepareMarketplaceResult,
} from "../../contexts/distribution/application/add/prepare-marketplace.js";
import type { RecordMarketplace } from "../../contexts/distribution/application/add/record-marketplace.js";
import { TrustDeniedError } from "../../shared/domain/errors/trust-denied-error.js";
import type { Prompter } from "../../shared/ports/prompter.js";
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

/** Adds a marketplace. With `overwrite`, the registered one is removed first: removing deletes
 * installed plugin files, which distribution does not own. An untrusted source is asked about
 * before the marketplace is saved. */
export class AddMarketplace {
  constructor(
    private readonly removeRegistered: Pick<RemoveRegisteredMarketplace, "execute">,
    private readonly prepare: Pick<PrepareMarketplace, "execute">,
    private readonly record: Pick<RecordMarketplace, "execute">,
    private readonly prompter: Prompter
  ) {}

  async execute(command: AddMarketplaceCommand): Promise<AddMarketplaceResult> {
    if (command.overwrite) {
      await this.removeRegistered.execute({ name: command.name, projectRoot: command.projectRoot });
    }
    const { marketplace, trusted } = await this.prepare.execute({
      ...command,
      replace: command.overwrite,
    });
    const trust = !trusted && (command.autoTrust || (await this.confirmTrust(command.name)));
    await this.record.execute({ marketplace, projectRoot: command.projectRoot, trust });
    return { marketplace };
  }

  private async confirmTrust(name: string): Promise<true> {
    if (!(await this.prompter.confirm(`Trust marketplace '${name}'?`))) {
      throw new TrustDeniedError(name);
    }
    return true;
  }
}
