import type { ToolId } from "../../../shared/domain/tool.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { Lock } from "../../../shared/ports/lock.js";
import { type HeldRefClaim, readHeldClaims } from "../domain/ref-claims.js";
import type { MachineManifestRepository, MachineRecords } from "../ports/machine-manifest.js";

export async function machineNativePluginClaim(
  repo: MachineManifestRepository | undefined,
  toolId: ToolId,
  ref: string
): Promise<HeldRefClaim | undefined> {
  if (repo === undefined) return undefined;
  const records = await repo.loadRecords();
  return readHeldClaims(records.get(toolId)?.pluginClaims).find((claim) => claim.ref === ref);
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
    if ((await repo.load()) === null) return;
    const records = await repo.loadRecords();
    const root = await fs.realpath(projectRoot);
    let changed = false;
    for (const [toolId, refs] of refsByTool) {
      changed = detachFromTool(records, toolId, { refs, root }) || changed;
    }
    if (changed) await repo.saveRecords(records);
  };
  await repo.withExclusiveAccess(action);
}

/** Drops `root` from the dependents of the targeted refs one tool claims, and says whether any
 * claim changed. */
function detachFromTool(
  records: MachineRecords,
  toolId: ToolId,
  { refs, root }: { readonly refs: readonly string[]; readonly root: string }
): boolean {
  const registration = records.get(toolId);
  if (registration?.pluginClaims === undefined) return false;
  const targeted = new Set(refs);
  let changed = false;
  const claims = readHeldClaims(registration.pluginClaims).map((claim) => {
    if (!targeted.has(claim.ref) || !claim.dependents.includes(root)) return claim;
    changed = true;
    return {
      ref: claim.ref,
      dependents: claim.dependents.filter((dependent) => dependent !== root),
    };
  });
  if (changed) records.set(toolId, { ...registration, pluginClaims: claims });
  return changed;
}
