import { join } from "node:path";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../../tools/contract/tool-profile.js";
import { resolveScopeForInstall, scopeBaseOf } from "../plugin-target-resolution.js";
import type { PlacePluginRequest } from "./place-plugin.use-case.js";

/** Finds the user-scope directory of a plugin that holds files this project did not install. */
export type FindForeignUserScopeDir = (
  command: PlacePluginRequest,
  tool: AiToolProfile
) => Promise<string | undefined>;

/** The foreign-directory lookup, bound to the file system and home it reads. */
export function foreignUserScopeDirOf(deps: {
  readonly fs: FileReader;
  readonly homedir: () => string;
}): FindForeignUserScopeDir {
  return (command, tool) => foreignUserScopeDir({ ...deps, command, tool });
}

/** The user-scope directory of the plugin when it holds files this project did not install. */
export async function foreignUserScopeDir(lookup: {
  readonly fs: FileReader;
  readonly command: PlacePluginRequest;
  readonly tool: AiToolProfile;
  readonly homedir: () => string;
}): Promise<string | undefined> {
  const { fs, command, tool, homedir } = lookup;
  const { projectRoot } = command;
  const pluginName = command.dist.manifest.name;
  if (resolveScopeForInstall(tool) !== "user") return undefined;
  if (machineOwnsUserScopeDir(command, tool)) return undefined;
  const dir = join(scopeBaseOf(tool, { scope: "user", projectRoot, homedir }), pluginName);
  const present = await fs.listFilesRecursive(dir);
  return present.length > 0 ? dir : undefined;
}

/** Whether the plugin's user-scope directory belongs to the machine's install of it. A tool that
 * installs per project has no such directory to share. */
export function machineOwnsUserScopeDir(
  command: Pick<PlacePluginRequest, "dist" | "machine">,
  tool: AiToolProfile
): boolean {
  if (resolveScopeForInstall(tool) !== "user") return false;
  const pluginName = command.dist.manifest.name;
  return command.machine.getPlugins(tool.toolId).some((p) => p.name === pluginName);
}
