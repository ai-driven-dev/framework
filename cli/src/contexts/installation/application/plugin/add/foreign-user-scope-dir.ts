import { homedir as nodeHomedir } from "node:os";
import { join } from "node:path";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../../tools/contract/tool-profile.js";
import { resolveScopeForInstall, scopeBaseOf } from "../plugin-target-resolution.js";
import type { PlacePluginRequest } from "./place-plugin.use-case.js";

/** The user-scope directory of the plugin when it holds files this project did not install. */
export async function foreignUserScopeDir(
  fs: FileReader,
  command: PlacePluginRequest,
  tool: AiToolProfile
): Promise<string | undefined> {
  const { projectRoot, machine } = command;
  const pluginName = command.dist.manifest.name;
  if (resolveScopeForInstall(tool) !== "user") return undefined;
  if (machine.getPlugins(tool.toolId).some((p) => p.name === pluginName)) return undefined;
  const dir = join(
    scopeBaseOf(tool, { scope: "user", projectRoot, homedir: nodeHomedir }),
    pluginName
  );
  const present = await fs.listFilesRecursive(dir);
  return present.length > 0 ? dir : undefined;
}
