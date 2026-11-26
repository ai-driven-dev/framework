import type { RemoveServerPlugins } from "../../contexts/host-registration/application/server/remove-server-plugins.use-case.js";
import type { RegistrationRecordRules } from "../../contexts/host-registration/contract/registration-record-rules.js";
import type {
  RemoveUserPlugin,
  RemoveUserPluginRequest,
} from "../../contexts/installation/application/removal/remove-user-plugin.use-case.js";
import { PluginNotFoundError } from "../../contexts/installation/contract/installation.error.js";
import type { ScopeRecords } from "../../contexts/installation/contract/records/scope-records.js";
import type { RecordClaimRules } from "../../contexts/machine-claims/contract/record-claim-rules.js";

/**
 * Removes a machine-scope plugin, selecting and dropping its native refs by the host registration's
 * rules, then from the host servers aidd installed it in. A host server is the only place aidd
 * holds some plugins, so a plugin the files never knew is not found only when no server held it
 * either.
 */
export class RemoveMachinePlugin {
  constructor(
    private readonly removeUserPlugin: Pick<RemoveUserPlugin<unknown>, "execute">,
    private readonly records: Pick<RegistrationRecordRules, "isQualifiedRef" | "refSelectedBy"> &
      Pick<RecordClaimRules, "withoutClaimedRef" | "claimsOf" | "holdersOf" | "pluginClaimsOf"> &
      ScopeRecords,
    private readonly servers?: Pick<RemoveServerPlugins, "execute">
  ) {}

  async execute(command: Omit<RemoveUserPluginRequest, "records">): Promise<void> {
    const absent = await this.absentFromFiles(command);
    const removed = await this.servers?.execute({
      plugin: command.pluginName,
      toolIds: command.toolIds,
    });
    if (absent !== undefined && (removed?.size ?? 0) === 0) throw absent;
  }

  private async absentFromFiles(
    command: Omit<RemoveUserPluginRequest, "records">
  ): Promise<PluginNotFoundError | undefined> {
    try {
      await this.removeUserPlugin.execute({ ...command, records: this.records });
    } catch (error) {
      if (error instanceof PluginNotFoundError) return error;
      throw error;
    }
    return undefined;
  }
}
