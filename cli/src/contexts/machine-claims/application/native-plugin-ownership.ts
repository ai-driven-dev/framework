import type { ToolId } from "../../../shared/domain/tool.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { Lock } from "../../../shared/ports/lock.js";
import type { MachineManifestRepository, MachinePluginClaim } from "../ports/machine-manifest.js";

export async function machineNativePluginClaim(
  repo: MachineManifestRepository | undefined,
  toolId: ToolId,
  ref: string
): Promise<MachinePluginClaim | undefined> {
  if (repo === undefined) return undefined;
  const machine = await repo.load();
  return machine?.getNativeRegistrations(toolId)?.pluginClaims?.find((claim) => claim.ref === ref);
}

export async function isMachineOwnedNativeRef(
  repo: MachineManifestRepository | undefined,
  toolId: ToolId,
  ref: string
): Promise<boolean> {
  return (await machineNativePluginClaim(repo, toolId, ref)) !== undefined;
}

export async function detachNativePluginRefs(request: {
  readonly repo: (MachineManifestRepository & Lock) | undefined;
  readonly fs: FileReader;
  readonly projectRoot: string;
  readonly refsByTool: ReadonlyMap<ToolId, readonly string[]>;
}): Promise<void> {
  const { repo, fs, projectRoot, refsByTool } = request;
  if (repo === undefined || refsByTool.size === 0) return;
  const action = async () => {
    const machine = await repo.load();
    if (machine === null) return;
    const root = await fs.realpath(projectRoot);
    let changed = false;
    for (const [toolId, refs] of refsByTool) {
      const registration = machine.getNativeRegistrations(toolId);
      if (registration?.pluginClaims === undefined) continue;
      const targeted = new Set(refs);
      const claims = registration.pluginClaims.map((claim) => {
        if (!targeted.has(claim.ref) || !claim.dependents.includes(root)) return claim;
        changed = true;
        return {
          ref: claim.ref,
          dependents: claim.dependents.filter((dependent) => dependent !== root),
        };
      });
      if (changed)
        machine.setNativeRegistrations(toolId, { ...registration, pluginClaims: claims });
    }
    if (changed) await repo.save(machine);
  };
  await repo.withExclusiveAccess(action);
}
