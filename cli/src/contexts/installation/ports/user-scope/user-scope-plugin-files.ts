// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { PluginPlacement } from "../tool-sections.js";

/** The files a user-scope plugin keeps under the OS home: which of them are safe to delete, and
 * their deletion. Nothing is deleted that `proven` did not first return. */
export interface UserScopePluginFileRemoval {
  /** The plugin's tracked files proven to sit inside the user scope and to be unedited since
   * install, by relative path with their install digest. */
  proven(
    plugin: InstalledPlugin,
    tool: PluginPlacement,
    home: string
  ): Promise<ReadonlyMap<string, string>>;
  /** Deletes the given files from the user plugins directory of `tool`, and takes the plugin's
   * rules out of the user guidance file the tool lists them in. */
  remove(
    files: ReadonlyMap<string, string>,
    tool: AiToolProfile,
    where: { projectRoot: string; home: string; plugin: string }
  ): Promise<void>;
}
