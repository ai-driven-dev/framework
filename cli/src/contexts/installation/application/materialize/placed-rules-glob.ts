import type { InstallationFile } from "../../../../shared/domain/installation-file.js";
import { rulesGlobOf } from "../../../../shared/domain/materialization/flat-paths.js";
// biome-ignore lint/plugin: asks the profile where a plugin's rules sit; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";

/** The glob listing the plugin's rules in the tool's config, when the install placed any under it. */
export function placedRulesGlob(
  tool: AiToolProfile,
  placed: { pluginName: string; files: readonly InstallationFile[] }
): string | null {
  return rulesGlobOf(
    tool.flatRulesPlacement(placed.pluginName),
    placed.files.map((file) => file.relativePath)
  );
}
