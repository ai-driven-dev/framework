import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { ToolId } from "../../../../kernel/tool.js";
import type { NativePluginClaim } from "../../domain/manifest/native-registrations.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";

export async function machineNativePluginClaim(
  repo: ManifestRepository | undefined,
  toolId: ToolId,
  ref: string
): Promise<NativePluginClaim | undefined> {
  if (repo === undefined) return undefined;
  const machine = await repo.load();
  return machine?.getNativeRegistrations(toolId)?.pluginClaims?.find((claim) => claim.ref === ref);
}

export async function isMachineOwnedNativeRef(
  repo: ManifestRepository | undefined,
  toolId: ToolId,
  ref: string
): Promise<boolean> {
  return (await machineNativePluginClaim(repo, toolId, ref)) !== undefined;
}

export async function detachNativePluginRefs(
  repo: ManifestRepository | undefined,
  fs: FileReader,
  projectRoot: string,
  refsByTool: ReadonlyMap<ToolId, readonly string[]>
): Promise<void> {
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
  if (repo.withExclusiveAccess !== undefined) await repo.withExclusiveAccess(action);
  else await action();
}
