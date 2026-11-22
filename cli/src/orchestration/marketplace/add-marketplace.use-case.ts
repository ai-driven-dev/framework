import type {
  PrepareMarketplace,
  PrepareMarketplaceRequest,
  PrepareMarketplaceResult,
} from "../../contexts/distribution/application/add/prepare-marketplace.use-case.js";
import type { RecordMarketplace } from "../../contexts/distribution/application/add/record-marketplace.use-case.js";
import { TrustDeniedError } from "../orchestration.error.js";
import type { Prompter } from "../ports/prompter.js";
import type { RemoveRegisteredMarketplace } from "./remove/remove-registered-marketplace.use-case.js";

export interface AddMarketplaceRequest extends Omit<PrepareMarketplaceRequest, "replace"> {
  /** Trusts the source without asking. */
  autoTrust: boolean;
  /** Removes the registered marketplace of the same name, with what was installed from it, once the new one is fetched. */
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

/** Adds a marketplace. With `overwrite`, the registered one is removed only once the new one is
 * fetched and trusted, so a failure keeps it: removing deletes installed plugin files, which
 * distribution does not own. An untrusted source is asked about before anything is removed. */
export class AddMarketplace {
  constructor(private readonly deps: AddMarketplaceDeps) {}

  async execute(command: AddMarketplaceRequest): Promise<AddMarketplaceResult> {
    const { marketplace, trusted } = await this.deps.prepare.execute({
      ...command,
      replace: command.overwrite,
    });
    const trust = !trusted && (command.autoTrust || (await this.confirmTrust(command.name)));
    if (command.overwrite) {
      await this.deps.removeRegistered.execute({
        name: command.name,
        projectRoot: command.projectRoot,
      });
    }
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
