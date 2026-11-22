import type { RegistrationRecordRules } from "../../contexts/host-registration/contract/registration-record-rules.js";
import type {
  RemoveUserPlugin,
  RemoveUserPluginRequest,
} from "../../contexts/installation/application/removal/remove-user-plugin.use-case.js";
import type { RecordClaimRules } from "../../contexts/machine-claims/contract/record-claim-rules.js";

/** Removes a machine-scope plugin, selecting and dropping its native refs by the host registration's rules. */
export class RemoveMachinePlugin {
  constructor(
    private readonly removeUserPlugin: Pick<RemoveUserPlugin<unknown>, "execute">,
    private readonly records: Pick<RegistrationRecordRules, "isQualifiedRef" | "refSelectedBy"> &
      Pick<RecordClaimRules, "withoutClaimedRef" | "claimsOf" | "dependentsOf">
  ) {}

  execute(command: Omit<RemoveUserPluginRequest, "records">): Promise<void> {
    return this.removeUserPlugin.execute({ ...command, records: this.records });
  }
}
