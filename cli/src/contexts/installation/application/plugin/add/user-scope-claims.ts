import { ToolNotInManifestError } from "../../../../../shared/domain/shared.error.js";
import type { AiToolId } from "../../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { Manifest } from "../../../domain/manifest.js";
import { InstalledPlugin } from "../../../domain/plugins/installed-plugin.js";

/** The `tool/plugin` keys the project manifest held before this add. */
export type PluginsInstalledBefore = ReadonlySet<string>;

export interface UserScopeClaim {
  readonly project: Manifest;
  readonly machine: Manifest;
  readonly toolIds: readonly AiToolId[];
  readonly projectRoot: string;
  readonly installedBefore: PluginsInstalledBefore;
}

interface PluginClaim {
  readonly project: Manifest;
  readonly machine: Manifest;
  readonly toolId: AiToolId;
  readonly plugin: InstalledPlugin;
  readonly root: string;
  readonly installedBefore: PluginsInstalledBefore;
}

export function pluginsInstalledBefore(
  manifest: Manifest,
  toolIds: readonly AiToolId[]
): PluginsInstalledBefore {
  return new Set(
    toolIds.flatMap((toolId) =>
      manifest.getPlugins(toolId).map((p) => installedKey(toolId, p.name))
    )
  );
}

function installedKey(toolId: AiToolId, pluginName: string): string {
  return `${toolId}/${pluginName}`;
}

/** Moves every newly user-scoped plugin's ownership to the machine manifest. True when one moved. */
export async function recordUserScopeOwnership(
  fs: Pick<FileReader, "realpath">,
  claim: UserScopeClaim
): Promise<boolean> {
  const { project, machine, toolIds, installedBefore } = claim;
  const root = await fs.realpath(claim.projectRoot);
  const claims = toolIds.flatMap((toolId) =>
    project
      .getPlugins(toolId)
      .map((plugin) => ({ project, machine, toolId, plugin, root, installedBefore }))
  );
  return claims.map(claimUserPlugin).includes(true);
}

/** Moves a user-scope plugin's ownership from the project manifest to the machine's. */
function claimUserPlugin(claim: PluginClaim): boolean {
  const { project, machine, toolId, plugin, root } = claim;
  const owned = machine.getPlugins(toolId).find((p) => p.name === plugin.name);
  if (!isClaimable(claim, owned)) return false;
  if (!machine.hasTool(toolId)) {
    const version = project.getToolVersion(toolId);
    if (version === undefined) throw new ToolNotInManifestError(toolId);
    machine.addTool(toolId, version, []);
  }
  const canonical = (owned ?? InstalledPlugin.withMcpEntries(plugin, new Map())).withDependents([
    ...(owned?.dependents ?? []),
    root,
  ]);
  machine.withPlugin(toolId, canonical);
  project.updatePlugin(toolId, plugin.withFiles(new Map()));
  return true;
}

/** An unowned plugin is claimed only when this add installed it and it carries files. */
function isClaimable(claim: PluginClaim, owned: InstalledPlugin | undefined): boolean {
  const { toolId, plugin, installedBefore } = claim;
  if (plugin.scope !== "user") return false;
  if (owned !== undefined) return true;
  return !installedBefore.has(installedKey(toolId, plugin.name)) && plugin.files.size > 0;
}
