import type { RegistrationRecordRules } from "../../../contexts/host-registration/contract/registration-record-rules.js";
import type {
  RemovePluginsFromMarketplace,
  RemovePluginsFromMarketplaceResult,
} from "../../../contexts/installation/application/marketplace/remove-plugins-from-marketplace.use-case.js";
import { pluginRefRecords } from "../../plugin/plugin-ref-records.js";
import type { Prompter } from "../../ports/prompter.js";

export interface RemoveMarketplacePluginsRequest {
  name: string;
  projectRoot: string;
  autoConfirm: boolean;
}

/** Removes the plugins installed from a project marketplace, once the person agrees. */
export class RemoveMarketplacePlugins {
  constructor(
    private readonly plugins: Pick<RemovePluginsFromMarketplace, "execute">,
    private readonly prompter: Pick<Prompter, "confirm">,
    private readonly records: Pick<RegistrationRecordRules, "refOf" | "withoutRef">
  ) {}

  execute(command: RemoveMarketplacePluginsRequest): Promise<RemovePluginsFromMarketplaceResult> {
    return this.plugins.execute({
      marketplace: command.name,
      projectRoot: command.projectRoot,
      confirm: (count) =>
        command.autoConfirm
          ? Promise.resolve(true)
          : this.prompter.confirm(`Remove ${count} plugin(s) installed from this marketplace?`),
      records: pluginRefRecords(this.records),
    });
  }
}
