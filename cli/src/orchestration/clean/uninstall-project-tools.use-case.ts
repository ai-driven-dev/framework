import type { RegistrationRecordRules } from "../../contexts/host-registration/contract/registration-record-rules.js";
import type {
  UninstallTools,
  UninstallToolsRequest,
  UninstallToolsResult,
} from "../../contexts/installation/application/uninstall-tools.use-case.js";

/** Removes tools from a project, reading each tool's recorded host refs by the host registration's rules. */
export class UninstallProjectTools {
  constructor(
    private readonly uninstallTools: Pick<UninstallTools, "execute">,
    private readonly records: Pick<RegistrationRecordRules, "pluginRefsOf">
  ) {}

  execute(command: Omit<UninstallToolsRequest, "records">): Promise<UninstallToolsResult[]> {
    return this.uninstallTools.execute({ ...command, records: this.records });
  }
}
