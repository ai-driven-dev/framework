import type { AiToolProfile } from "../../tools/contract/tool-profile.js";
import type { InstalledPlugin } from "../domain/plugins/installed-plugin.js";

/** The files of a user-scope plugin that are safe to delete, by relative path with their install
 * digest: those still inside the tool's own user directory and unedited since install. */
export type UserPluginFileProof = (
  plugin: InstalledPlugin,
  tool: AiToolProfile,
  home: string
) => Promise<ReadonlyMap<string, string>>;
