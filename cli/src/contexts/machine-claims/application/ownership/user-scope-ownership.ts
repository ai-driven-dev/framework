import { ToolNotInManifestError } from "../../../../shared/domain/shared.error.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import { dependentsClaim, readDependents } from "../../domain/plugin-dependents.js";
import type {
  MachineUserPlugin,
  OwnershipMachineManifest,
  OwnershipProjectManifest,
  ProjectUserPlugin,
} from "../../ports/machine-manifest.js";

/** The `tool/plugin` keys the project manifest held before an add. */
export type PluginsInstalledBefore = ReadonlySet<string>;

export interface UserScopeClaim {
  readonly project: OwnershipProjectManifest;
  readonly machine: OwnershipMachineManifest;
  readonly toolIds: readonly AiToolId[];
  readonly projectRoot: string;
  readonly installedBefore: PluginsInstalledBefore;
}

interface PluginClaim {
  readonly project: OwnershipProjectManifest;
  readonly machine: OwnershipMachineManifest;
  readonly toolId: AiToolId;
  readonly plugin: ProjectUserPlugin;
  readonly root: string;
  readonly installedBefore: PluginsInstalledBefore;
}

function installedKey(toolId: AiToolId, pluginName: string): string {
  return `${toolId}/${pluginName}`;
}

/** Who holds the user-scope plugins an add leaves with the machine: which the project already had,
 * and which the add moves over. */
export function userScopeOwnership(fs: Pick<FileReader, "realpath">) {
  return {
    installedBefore(
      manifest: OwnershipProjectManifest,
      toolIds: readonly AiToolId[]
    ): PluginsInstalledBefore {
      return new Set(
        toolIds.flatMap((toolId) =>
          manifest.getPlugins(toolId).map((p) => installedKey(toolId, p.name))
        )
      );
    },
    record: (claim: UserScopeClaim) => recordUserScopeOwnership(fs, claim),
  };
}

/** Moves every newly user-scoped plugin's ownership to the machine manifest. True when one moved. */
async function recordUserScopeOwnership(
  fs: Pick<FileReader, "realpath">,
  claim: UserScopeClaim
): Promise<boolean> {
  const { project, machine, toolIds, installedBefore } = claim;
  const root = await fs.realpath(claim.projectRoot);
  const claims = toolIds.flatMap((toolId) =>
    project
      .getRecordedPlugins(toolId)
      .map((plugin) => ({ project, machine, toolId, plugin, root, installedBefore }))
  );
  return claims.map(claimUserPlugin).includes(true);
}

/** Moves a user-scope plugin's ownership from the project manifest to the machine's. */
function claimUserPlugin(claim: PluginClaim): boolean {
  const { project, machine, toolId, plugin: recorded, root } = claim;
  const { plugin } = recorded;
  const owned = machine.getRecordedPlugins(toolId).find((p) => p.plugin.name === plugin.name);
  if (!isClaimable(claim, owned)) return false;
  if (!machine.hasTool(toolId)) {
    const version = project.getToolVersion(toolId);
    if (version === undefined) throw new ToolNotInManifestError(toolId);
    machine.addTool(toolId, version, []);
  }
  const canonical = (owned ?? recorded.withMcpEntries(new Map())).withMachineClaim(
    dependentsClaim([...readDependents(owned?.machineClaim), root])
  );
  machine.withPlugin(toolId, canonical);
  project.updatePlugin(toolId, recorded.withFiles(new Map()));
  return true;
}

/** An unowned plugin is claimed only when this add installed it and it carries files. */
function isClaimable(claim: PluginClaim, owned: MachineUserPlugin | undefined): boolean {
  const { toolId, installedBefore } = claim;
  const { plugin } = claim.plugin;
  if (plugin.scope !== "user") return false;
  if (owned !== undefined) return true;
  return !installedBefore.has(installedKey(toolId, plugin.name)) && plugin.files.size > 0;
}
