import type { RefreshHostPlugin } from "../../contexts/host-registration/application/refresh-host-plugin.use-case.js";
import type { RegistrationRecordRules } from "../../contexts/host-registration/contract/registration-record-rules.js";
import type { UpdatePluginRequest } from "../../contexts/installation/application/plugin/update-plugin.use-case.js";
import type { UpdateUserPluginFiles } from "../../contexts/installation/application/plugin/update-user-plugin-files.use-case.js";
import type { RecordClaimRules } from "../../contexts/machine-claims/contract/record-claim-rules.js";
import type { IsWithinUserScope } from "../../contexts/machine-claims/contract/user-scope-containment.js";
import { UserPluginUpdatePartialError } from "../orchestration.error.js";

export type UpdateUserPluginRequest = UpdatePluginRequest;

/**
 * Updates the machine-scope plugins and the native refs aidd owns. The host proves and refreshes
 * each native ref through its own context, and the installation command decides when.
 */
export class UpdateUserPlugin {
  constructor(
    private readonly updateUserPluginFiles: Pick<UpdateUserPluginFiles, "execute">,
    private readonly refreshHostPlugin: Pick<RefreshHostPlugin, "execute">,
    private readonly isWithinUserScope: IsWithinUserScope,
    private readonly refSelection: Pick<
      RegistrationRecordRules,
      "isQualifiedRef" | "refSelectedBy"
    > &
      Pick<RecordClaimRules, "claimsOf" | "holdersOf">
  ) {}

  async execute(command: UpdateUserPluginRequest): Promise<string[]> {
    return this.updateUserPluginFiles.execute({
      ...command,
      isWithinUserScope: this.isWithinUserScope,
      refreshNative: (request) => this.refreshHostPlugin.execute(request),
      refSelection: this.refSelection,
      afterPreflight: (toolId, apply) =>
        apply().catch((cause: unknown) => {
          throw new UserPluginUpdatePartialError(toolId, { cause });
        }),
    });
  }
}
