import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { Manifest } from "../../domain/manifest.js";
import type { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";

/** Records the project as a holder of a user-scope plugin on the machine manifest. The machine
 * claims write it; an add decides which plugins move and calls it inside its lock. */
export interface UserScopeOwnership {
  execute(claim: {
    machine: Manifest;
    toolId: AiToolId;
    plugin: RecordedPlugin;
    toolVersion: string | undefined;
    projectRoot: string;
  }): Promise<void>;
}

/** The `tool/plugin` keys the project manifest holds for these tools. */
export function pluginsHeld(manifest: Manifest, toolIds: readonly AiToolId[]): ReadonlySet<string> {
  return new Set(
    toolIds.flatMap((toolId) => manifest.getPlugins(toolId).map((p) => keyOf(toolId, p.name)))
  );
}

const keyOf = (toolId: AiToolId, pluginName: string) => `${toolId}/${pluginName}`;

/** A user-scope plugin moves when the machine already holds it, or when this add installed it
 * with files. */
function isClaimable(
  recorded: RecordedPlugin,
  toolId: AiToolId,
  add: { machine: Manifest; heldBefore: ReadonlySet<string> }
): boolean {
  const { plugin } = recorded;
  if (plugin.scope !== "user") return false;
  if (add.machine.getRecordedPlugins(toolId).some((p) => p.plugin.name === plugin.name))
    return true;
  return !add.heldBefore.has(keyOf(toolId, plugin.name)) && plugin.files.size > 0;
}

/** Hands to the machine each plugin the add leaves user-scoped, and drops its files from the
 * project record. True when one moved. */
export async function claimUserScopePlugins(
  ownership: UserScopeOwnership,
  add: {
    project: Manifest;
    machine: Manifest;
    toolIds: readonly AiToolId[];
    projectRoot: string;
    heldBefore: ReadonlySet<string>;
  }
): Promise<boolean> {
  const { project, machine, projectRoot } = add;
  let moved = false;
  for (const toolId of add.toolIds) {
    for (const plugin of project.getRecordedPlugins(toolId)) {
      if (!isClaimable(plugin, toolId, add)) continue;
      const toolVersion = project.getToolVersion(toolId);
      await ownership.execute({ machine, toolId, plugin, toolVersion, projectRoot });
      project.updatePlugin(toolId, plugin.withFiles(new Map()));
      moved = true;
    }
  }
  return moved;
}
