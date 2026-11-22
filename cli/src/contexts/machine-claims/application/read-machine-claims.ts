import type { AiToolId } from "../../../shared/domain/tool.js";
import { readHeldClaims } from "../domain/ref-claims.js";
import type { MachineManifestRepository } from "../ports/machine-manifest.js";

/** The machine-wide claims on `toolId`'s refs; `undefined` when no machine record exists. */
export function readMachineClaims(userManifestRepo: MachineManifestRepository) {
  return async (toolId: AiToolId) => {
    const machine = await userManifestRepo.load();
    if (machine === null) return undefined;
    return readHeldClaims(machine.getNativeRegistrations(toolId)?.pluginClaims);
  };
}
