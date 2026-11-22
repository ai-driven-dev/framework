import type { ToolId } from "../../../../shared/domain/tool.js";
import { readHeldClaims } from "../../domain/plugin-claim.model.js";
import type { MachineManifestRepository } from "../../ports/machine-manifest.js";

export class IsMachineOwnedNativeRef {
  constructor(private readonly repo: MachineManifestRepository | undefined) {}

  /** Whether the machine manifest records a claim on `ref` for this tool. */
  async execute(toolId: ToolId, ref: string): Promise<boolean> {
    if (this.repo === undefined) return false;
    const records = await this.repo.loadRecords();
    return readHeldClaims(records.get(toolId)?.pluginClaims).some((claim) => claim.ref === ref);
  }
}
