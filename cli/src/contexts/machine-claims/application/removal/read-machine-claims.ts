import type { AiToolId } from "../../../../shared/domain/tool.js";
import { readHeldClaims } from "../../domain/plugin-claim.model.js";
import type { MachineManifestRepository } from "../../ports/machine-manifest.js";

/** What the machine-wide record says about the claims on a tool's refs. */
export function readMachineClaims(userManifestRepo: MachineManifestRepository) {
  const claimsOf = async (toolId: AiToolId) => {
    const machine = await userManifestRepo.load();
    if (machine === null) return undefined;
    const records = await userManifestRepo.loadRecords();
    return readHeldClaims(records.get(toolId)?.pluginClaims);
  };
  return {
    /** The refs claimed on the machine; `undefined` when no machine record exists. */
    claimedRefs: async (toolId: AiToolId): Promise<readonly string[] | undefined> =>
      (await claimsOf(toolId))?.map((claim) => claim.ref),
    /** The projects other than `projectRoot` holding any of `refs`, once each. */
    othersHolding: async (
      toolId: AiToolId,
      refs: readonly string[],
      projectRoot: string
    ): Promise<readonly string[]> => {
      const held = (await claimsOf(toolId))?.filter((claim) => refs.includes(claim.ref)) ?? [];
      return [
        ...new Set(
          held.flatMap((claim) => claim.dependents.filter((root) => root !== projectRoot))
        ),
      ];
    },
  };
}
