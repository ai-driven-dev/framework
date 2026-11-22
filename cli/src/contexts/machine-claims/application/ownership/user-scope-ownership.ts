import { ToolNotInManifestError } from "../../../../shared/domain/shared.error.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import { dependentsClaim, readDependents } from "../../domain/plugin-claim.model.js";
import type { OwnershipMachineManifest, UserPluginToClaim } from "../../ports/machine-manifest.js";

/** A user-scope plugin a project hands to the machine, with the project that holds it. */
export interface UserScopeClaim {
  readonly machine: OwnershipMachineManifest;
  readonly toolId: AiToolId;
  readonly plugin: UserPluginToClaim;
  /** The tool's version in the project record, needed when the machine does not track the tool. */
  readonly toolVersion: string | undefined;
  readonly projectRoot: string;
}

/** Records the project as a holder of a user-scope plugin on the machine manifest. */
export function userScopeOwnership(fs: Pick<FileReader, "realpath">) {
  return {
    async record(claim: UserScopeClaim): Promise<void> {
      const { machine, toolId, plugin, toolVersion } = claim;
      const root = await fs.realpath(claim.projectRoot);
      const owned = machine
        .getRecordedPlugins(toolId)
        .find((p) => p.plugin.name === plugin.plugin.name);
      if (!machine.hasTool(toolId)) {
        if (toolVersion === undefined) throw new ToolNotInManifestError(toolId);
        machine.addTool(toolId, toolVersion, []);
      }
      const canonical = (owned ?? plugin.withMcpEntries(new Map())).withMachineClaim(
        dependentsClaim([...readDependents(owned?.machineClaim), root])
      );
      machine.withPlugin(toolId, canonical);
    },
  };
}
