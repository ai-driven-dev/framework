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
  /** Deletes the given files from the user plugins directory of `tool`. */
  remove(
    files: ReadonlyMap<string, string>,
    tool: PluginPlacement,
    where: { projectRoot: string; home: string }
  ): Promise<void>;
}
